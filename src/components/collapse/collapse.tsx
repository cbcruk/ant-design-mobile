import { animated, useSpring } from '@react-spring/web'
import { useMount } from 'ahooks'
import { DownOutline } from 'antd-mobile-icons'
import classNames from 'classnames'
import type { FC, ReactElement, ReactNode } from 'react'
import React, { isValidElement, useRef } from 'react'
import { NativeProps, withNativeProps } from '../../utils/native-props'
import { useShouldRender } from '../../utils/should-render'
import { traverseReactNode } from '../../utils/traverse-react-node'
import { useIsomorphicUpdateLayoutEffect } from '../../utils/use-isomorphic-update-layout-effect'
import { observe } from '../../utils/use-mutation-effect'
import { usePropsValue } from '../../utils/use-props-value'
import { mergeProp, mergeProps } from '../../utils/with-default-props'
import { useConfig } from '../config-provider'
import List from '../list'

// 콜랩스 컴포넌트의 CSS 클래스 접두사
const classPrefix = `adm-collapse`

// 콜랩스 패널의 Props 타입 정의
export type CollapsePanelProps = {
  key: string
  title: ReactNode
  disabled?: boolean
  forceRender?: boolean
  destroyOnClose?: boolean
  onClick?: (event: React.MouseEvent<Element, MouseEvent>) => void
  arrowIcon?: ReactNode | ((active: boolean) => ReactNode)
  children?: ReactNode
  /**
   * @deprecated use `arrowIcon` instead
   */
  arrow?: ReactNode | ((active: boolean) => ReactNode)
} & NativeProps

// 콜랩스 패널 컴포넌트 - 실제로는 null을 반환하며 타입 정의용으로만 사용
export const CollapsePanel: FC<CollapsePanelProps> = () => {
  return null
}

// 콜랩스 패널 내용 컴포넌트 - 애니메이션과 함께 콘텐츠를 표시/숨김
const CollapsePanelContent: FC<{
  visible: boolean
  forceRender: boolean
  destroyOnClose: boolean
  children?: ReactNode
}> = props => {
  const { visible } = props
  const innerRef = useRef<HTMLDivElement>(null)
  // 렌더링 조건 확인 - forceRender, destroyOnClose 옵션에 따라 결정
  const shouldRender = useShouldRender(
    visible,
    props.forceRender,
    props.destroyOnClose
  )
  // react-spring을 사용한 높이 애니메이션 설정
  const [{ height }, api] = useSpring(() => ({
    from: { height: 0 },
    config: {
      precision: 0.01,
      mass: 1,
      tension: 200,
      friction: 25,
      clamp: true,
    },
  }))

  useMount(() => {
    if (!visible) return
    const inner = innerRef.current
    if (!inner) return
    api.start({
      height: inner.offsetHeight,
      immediate: true,
    })
  })

  useIsomorphicUpdateLayoutEffect(() => {
    const inner = innerRef.current
    if (!inner) return

    if (visible) {
      // 동적 콘텐츠 높이 변화 감지 및 애니메이션 시스템
      // 문제: 콜랩스 패널 내용이 동적으로 변할 때 높이 애니메이션이 깨짐
      // 해결: MutationObserver로 DOM 변화를 감지하여 실시간으로 높이 재계산
      let lastMotionId = 0
      let cancelObserve: VoidFunction = () => {}

      const handleMotion = () => {
        // 동시에 여러 애니메이션이 실행되는 것을 방지하기 위한 ID 시스템
        // 최신 애니메이션만 유효하도록 하여 깜빡임 현상 방지
        lastMotionId += 1
        const motionId = lastMotionId

        api.start({ height: inner.offsetHeight })[0].then(() => {
          // 애니메이션 완료 시점에서 최신 애니메이션인지 확인 후 observer 해제
          if (motionId === lastMotionId) {
            cancelObserve()
          }
        })
      }

      // DOM 변화 감지: 자식 요소 추가/제거, 텍스트 변경 등을 모두 감지
      // subtree: true로 중첩된 요소의 변화도 감지하여 완전한 동적 높이 지원
      cancelObserve = observe(
        inner,
        { childList: true, subtree: true },
        handleMotion
      )
      handleMotion()
      return cancelObserve
    } else {
      // 닫힐 때: 현재 높이에서 0으로 부드럽게 애니메이션
      // immediate: true로 시작 높이를 즉시 설정한 후 0으로 애니메이션
      api.start({ height: inner.offsetHeight, immediate: true })
      api.start({ height: 0 })
    }
  }, [visible])

  return (
    <animated.div
      className={classNames(`${classPrefix}-panel-content`, {
        [`${classPrefix}-panel-content-active`]: visible,
      })}
      style={{
        height: height.to(v => {
          if (height.idle && visible) {
            return 'auto'
          } else {
            return v
          }
        }),
      }}
    >
      <div className={`${classPrefix}-panel-content-inner`} ref={innerRef}>
        <List.Item>{shouldRender && props.children}</List.Item>
      </div>
    </animated.div>
  )
}

type ValueProps<T> = {
  activeKey?: T
  defaultActiveKey?: T
  onChange?: (activeKey: T) => void
  arrowIcon?: ReactNode | ((active: boolean) => ReactNode)
  /**
   * @deprecated use `arrowIcon` instead
   */
  arrow?: ReactNode | ((active: boolean) => ReactNode)
}

export type CollapseProps = (
  | ({
      accordion?: false
    } & ValueProps<string[]>)
  | ({
      accordion: true
    } & ValueProps<string | null>)
) & {
  children?: ReactNode
} & NativeProps

export const Collapse: FC<CollapseProps> = props => {
  const { collapse: componentConfig = {} } = useConfig()
  const mergedProps = mergeProps(componentConfig, props)
  const panels: ReactElement<CollapsePanelProps>[] = []
  traverseReactNode(mergedProps.children, child => {
    if (!isValidElement<CollapsePanelProps>(child)) return
    const key = child.key
    if (typeof key !== 'string') return

    panels.push(child)
  })

  const handlePropsValue = () => {
    if (!mergedProps.accordion) {
      return {
        value: mergedProps.activeKey,
        defaultValue: mergedProps.defaultActiveKey ?? [],
        onChange: mergedProps.onChange,
      }
    }

    const initValue: {
      value?: string[]
      defaultValue: string[]
      onChange: (v: string[]) => void
    } = {
      value: [],
      defaultValue: [],
      onChange: v => {
        mergedProps.onChange?.(v[0] ?? null)
      },
    }

    if (mergedProps.activeKey === undefined) {
      initValue.value = undefined
    } else if (mergedProps.activeKey !== null) {
      initValue.value = [mergedProps.activeKey]
    }

    if (
      ![null, undefined].includes(
        mergedProps.defaultActiveKey as null | undefined
      )
    ) {
      initValue.defaultValue = [mergedProps.defaultActiveKey as string]
    }

    return initValue
  }

  const [activeKey, setActiveKey] = usePropsValue<string[]>(handlePropsValue())

  const activeKeyList =
    activeKey === null ? [] : Array.isArray(activeKey) ? activeKey : [activeKey]

  return withNativeProps(
    mergedProps,
    <div className={classPrefix}>
      <List>
        {panels.map(panel => {
          const key = panel.key as string
          const active = activeKeyList.includes(key)
          function handleClick(event: React.MouseEvent<Element, MouseEvent>) {
            if (mergedProps.accordion) {
              if (active) {
                setActiveKey([])
              } else {
                setActiveKey([key])
              }
            } else {
              if (active) {
                setActiveKey(activeKeyList.filter(v => v !== key))
              } else {
                setActiveKey([...activeKeyList, key])
              }
            }

            panel.props.onClick?.(event)
          }

          const arrow = mergeProp(
            <DownOutline />,
            mergedProps.arrow,
            mergedProps.arrowIcon,
            panel.props.arrow,
            panel.props.arrowIcon
          )

          const arrowIcon =
            typeof arrow === 'function' ? (
              arrow(active)
            ) : (
              <div
                className={classNames(`${classPrefix}-arrow`, {
                  [`${classPrefix}-arrow-active`]: active,
                })}
              >
                {arrow}
              </div>
            )

          return (
            <React.Fragment key={key}>
              {withNativeProps(
                panel.props,
                <List.Item
                  className={`${classPrefix}-panel-header`}
                  onClick={handleClick}
                  disabled={panel.props.disabled}
                  arrowIcon={arrowIcon}
                >
                  {panel.props.title}
                </List.Item>
              )}
              <CollapsePanelContent
                visible={active}
                forceRender={!!panel.props.forceRender}
                destroyOnClose={!!panel.props.destroyOnClose}
              >
                {panel.props.children}
              </CollapsePanelContent>
            </React.Fragment>
          )
        })}
      </List>
    </div>
  )
}
