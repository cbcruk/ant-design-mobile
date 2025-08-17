import { animated, useSpring } from '@react-spring/web'
import { useSize } from 'ahooks'
import type { FC, MutableRefObject, ReactNode, RefObject } from 'react'
import React, { useRef } from 'react'
import { bound } from '../../utils/bound'
import type { Matrix } from '../../utils/matrix'
import * as mat from '../../utils/matrix'
import { rubberbandIfOutOfBounds } from '../../utils/rubberband'
import { useDragAndPinch } from '../../utils/use-drag-and-pinch'

const classPrefix = `adm-image-viewer`

type Props = {
  image: string
  maxZoom: number | 'auto'
  onTap?: () => void
  onZoomChange?: (zoom: number) => void
  dragLockRef?: MutableRefObject<boolean>
  imageRender?: (
    image: string,
    { ref, index }: { ref: RefObject<HTMLImageElement>; index: number }
  ) => ReactNode
  index?: number
}

// 이미지 슬라이드 컴포넌트 - 매트릭스 변환 기반 고급 제스처 인터렉션
// 설계 의도: 2D 매트릭스 연산을 통한 정밀한 이미지 확대/축소/팬 제어
// 핵심 특징: 멀티터치 제스처, 경계 검증, 탄성 효과, 관성 스크롤, 더블탭 확대
export const Slide: FC<Props> = props => {
  const { dragLockRef, maxZoom, imageRender, index } = props

  // 드래그 시작 시점의 경계 도달 상태 캐싱 (좌우 스와이프 감지용)
  const initialMartix = useRef<boolean[]>([])
  const controlRef = useRef<HTMLDivElement>(null) // 제스처 이벤트 수신 영역
  const imgRef = useRef<HTMLImageElement>(null) // 실제 이미지 요소

  // React Spring 기반 매트릭스 애니메이션: 부드러운 확대/축소/이동 효과
  // 핵심 설계: CSS transform matrix를 직접 조작하여 GPU 가속 활용
  const [{ matrix }, api] = useSpring(() => ({
    matrix: mat.create(), // 단위 행렬로 초기화 (변환 없음)
    config: { tension: 200 }, // 자연스러운 탄성 애니메이션
  }))

  // 실시간 크기 추적: 반응형 레이아웃과 정확한 경계 계산을 위한 크기 모니터링
  const controlSize = useSize(controlRef) // 뷰포트 크기
  const imgSize = useSize(imgRef) // 실제 이미지 크기

  // 핀치 제스처 상태: 확대/축소 중 드래그 충돌 방지용
  const pinchLockRef = useRef(false)

  // 이미지 위치 경계 계산 함수: 확대된 이미지가 뷰포트 밖으로 나가지 않도록 하는 경계값 계산
  // 핵심 설계: 중심점 기준 좌표계에서 이미지와 뷰포트의 상대적 위치 관계 분석
  const getMinAndMax = (
    nextMatrix: Matrix
  ): {
    x: {
      position: number // 현재 x 위치
      minX: number // 최소 x 경계 (가장 왼쪽으로 갈 수 있는 위치)
      maxX: number // 최대 x 경계 (가장 오른쪽으로 갈 수 있는 위치)
    }
    y: {
      position: number // 현재 y 위치
      minY: number // 최소 y 경계 (가장 위로 갈 수 있는 위치)
      maxY: number // 최대 y 경계 (가장 아래로 갈 수 있는 위치)
    }
  } => {
    // 크기 정보가 없으면 기본값 반환
    if (!controlSize || !imgSize)
      return {
        x: { position: 0, minX: 0, maxX: 0 },
        y: { position: 0, minY: 0, maxY: 0 },
      }

    // 중심점 기준 좌표계 설정: 화면과 이미지의 중심을 (0, 0)으로 하는 좌표계
    const controlLeft = -controlSize.width / 2 // 뷰포트 왼쪽 경계
    const controlTop = -controlSize.height / 2 // 뷰포트 상단 경계

    const imgLeft = -imgSize.width / 2 // 원본 이미지 왼쪽 경계
    const imgTop = -imgSize.height / 2 // 원본 이미지 상단 경계

    // 현재 확대 배율과 확대된 이미지 크기 계산
    const zoom = mat.getScaleX(nextMatrix)
    const scaledImgWidth = zoom * imgSize.width
    const scaledImgHeight = zoom * imgSize.height

    // X축 경계 계산: 확대된 이미지가 뷰포트를 벗어나지 않는 최소/최대 위치
    // minX: 이미지 오른쪽 끝이 뷰포트 오른쪽 끝에 닿는 위치 (가장 왼쪽으로 이동 가능)
    // maxX: 이미지 왼쪽 끝이 뷰포트 왼쪽 끝에 닿는 위치 (가장 오른쪽으로 이동 가능)
    const minX = controlLeft - (scaledImgWidth - controlSize.width)
    const maxX = controlLeft

    // Y축 경계도 동일한 원리로 계산
    const minY = controlTop - (scaledImgHeight - controlSize.height)
    const maxY = controlTop

    // 매트릭스를 이미지 중심점에 적용하여 현재 위치 계산
    const [x, y] = mat.apply(nextMatrix, [imgLeft, imgTop])

    return {
      x: { position: x, minX, maxX },
      y: { position: y, minY, maxY },
    }
  }

  // 경계 도달 검사 함수: 현재 위치가 경계에 도달했는지 확인 (버퍼 옵션 포함)
  const getReachBound = (
    position: number,
    min: number,
    max: number,
    buffer = 0 // 여유 공간: 경계 근처에서도 도달로 간주할 범위
  ) => {
    return [
      position <= min - buffer, // 최소 경계 도달 여부
      position >= max + buffer, // 최대 경계 도달 여부
    ]
  }

  // 매트릭스 경계 제한 함수: 이미지가 화면 밖으로 나가지 않도록 매트릭스 보정
  // 핵심 설계: 드래그 중에는 탄성 효과, 완료 시에는 엄격한 경계 적용
  const boundMatrix = (
    nextMatrix: Matrix,
    type: 'translate' | 'scale', // 이동 vs 확대/축소에 따른 다른 처리
    last = false // 제스처 완료 여부 (중요: 처리 방식 결정)
  ): Matrix => {
    if (!controlSize || !imgSize) return nextMatrix

    const zoom = mat.getScaleX(nextMatrix)
    const scaledImgWidth = zoom * imgSize.width
    const scaledImgHeight = zoom * imgSize.height

    const {
      x: { position: x, minX, maxX },
      y: { position: y, minY, maxY },
    } = getMinAndMax(nextMatrix)

    // 이동(translate) 처리: 드래그나 관성 스크롤 시의 위치 보정
    if (type === 'translate') {
      let boundedX = x
      let boundedY = y

      // X축 경계 처리: 이미지가 뷰포트보다 큰 경우만 경계 적용
      if (scaledImgWidth > controlSize.width) {
        boundedX = last
          ? bound(x, minX, maxX) // 제스처 완료: 엄격한 경계 적용
          : rubberbandIfOutOfBounds(x, minX, maxX, zoom * 50) // 드래그 중: iOS 스타일 탄성 효과
      } else {
        // 이미지가 뷰포트보다 작으면 중앙 정렬
        boundedX = -scaledImgWidth / 2
      }

      // Y축도 동일한 로직 적용
      if (scaledImgHeight > controlSize.height) {
        boundedY = last
          ? bound(y, minY, maxY)
          : rubberbandIfOutOfBounds(y, minY, maxY, zoom * 50)
      } else {
        boundedY = -scaledImgHeight / 2
      }

      // 보정된 위치로 이동하는 변환 매트릭스 반환
      return mat.translate(nextMatrix, boundedX - x, boundedY - y)
    }

    // 확대/축소(scale) 완료 시 처리: 확대 후 위치가 유효한지 검증하고 보정
    if (type === 'scale' && last) {
      const [boundedX, boundedY] = [
        scaledImgWidth > controlSize.width
          ? bound(x, minX, maxX) // 확대된 이미지가 큰 경우 경계 내로 제한
          : -scaledImgWidth / 2, // 작은 경우 중앙 정렬
        scaledImgHeight > controlSize.height
          ? bound(y, minY, maxY)
          : -scaledImgHeight / 2,
      ]
      return mat.translate(nextMatrix, boundedX - x, boundedY - y)
    }

    return nextMatrix // 조건에 맞지 않으면 원본 반환
  }

  useDragAndPinch(
    {
      onDrag: state => {
        if (state.first) {
          const {
            x: { position: x, minX, maxX },
          } = getMinAndMax(matrix.get())
          initialMartix.current = getReachBound(x, minX, maxX)
          return
        }
        if (state.pinching) return state.cancel()

        if (state.tap && state.elapsedTime > 0 && state.elapsedTime < 1000) {
          // 判断点击时间>0是为了过滤掉非正常操作，例如用户长按选择图片之后的取消操作（也是一次点击）
          props.onTap?.()
          return
        }
        const currentZoom = mat.getScaleX(matrix.get())
        if (dragLockRef) {
          dragLockRef.current = currentZoom !== 1
        }
        if (!pinchLockRef.current && currentZoom <= 1) {
          api.start({
            matrix: mat.create(),
          })
        } else {
          const currentMatrix = matrix.get()
          const offset = [
            state.offset[0] - mat.getTranslateX(currentMatrix),
            state.offset[1] - mat.getTranslateY(currentMatrix),
          ] as const

          const nextMatrix = mat.translate(
            currentMatrix,
            ...(state.last
              ? ([
                  offset[0] + state.velocity[0] * state.direction[0] * 200,
                  offset[1] + state.velocity[1] * state.direction[1] * 200,
                ] as const)
              : offset)
          )

          api.start({
            matrix: boundMatrix(nextMatrix, 'translate', state.last),
            immediate: !state.last,
          })

          const {
            x: { position: x, minX, maxX },
          } = getMinAndMax(nextMatrix)
          if (
            state.last &&
            initialMartix.current.some(i => i) &&
            getReachBound(x, minX, maxX).some(i => i)
          ) {
            if (dragLockRef) {
              dragLockRef.current = false
            }

            api.start({
              matrix: mat.create(),
            })
          }
        }
      },
      onPinch: state => {
        pinchLockRef.current = !state.last
        const [d] = state.offset
        if (d < 0) return
        let mergedMaxZoom: number
        if (maxZoom === 'auto') {
          mergedMaxZoom =
            controlSize && imgSize
              ? Math.max(
                  controlSize.height / imgSize.height,
                  controlSize.width / imgSize.width
                )
              : 1
        } else {
          mergedMaxZoom = maxZoom
        }

        const nextZoom = state.last ? bound(d, 1, mergedMaxZoom) : d
        props.onZoomChange?.(nextZoom)
        if (state.last && nextZoom <= 1) {
          api.start({
            matrix: mat.create(),
          })
          if (dragLockRef) {
            dragLockRef.current = false
          }
        } else {
          if (!controlSize) return

          const currentMatrix = matrix.get()
          const currentZoom = mat.getScaleX(currentMatrix)

          const originOffsetX = state.origin[0] - controlSize.width / 2
          const originOffsetY = state.origin[1] - controlSize.height / 2
          let nextMatrix = mat.translate(
            currentMatrix,
            -originOffsetX,
            -originOffsetY
          )
          nextMatrix = mat.scale(nextMatrix, nextZoom / currentZoom)
          nextMatrix = mat.translate(nextMatrix, originOffsetX, originOffsetY)
          api.start({
            matrix: boundMatrix(nextMatrix, 'scale', state.last),
            immediate: !state.last,
          })
          if (dragLockRef) {
            dragLockRef.current = true
          }
        }
      },
    },
    {
      target: controlRef,
      drag: {
        from: () => [
          mat.getTranslateX(matrix.get()),
          mat.getTranslateY(matrix.get()),
        ],
        pointer: { touch: true },
      },
      pinch: {
        from: () => [mat.getScaleX(matrix.get()), 0],
        pointer: { touch: true },
      },
    }
  )

  const customRendering =
    typeof imageRender === 'function' &&
    imageRender(props.image, { ref: imgRef, index: index ?? 0 })

  return (
    <div className={`${classPrefix}-slide`}>
      <div className={`${classPrefix}-control`} ref={controlRef}>
        <animated.div
          className={`${classPrefix}-image-wrapper`}
          style={{
            matrix,
          }}
        >
          {customRendering ? (
            customRendering
          ) : (
            <img
              ref={imgRef}
              src={props.image}
              draggable={false}
              alt={props.image}
            />
          )}
        </animated.div>
      </div>
    </div>
  )
}
