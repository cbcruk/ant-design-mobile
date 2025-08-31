import React from 'react'
import type { FC, CSSProperties, ReactNode } from 'react'
import { mergeProps } from '../../utils/with-default-props'
import { NativeProps, withNativeProps } from '../../utils/native-props'
import classNames from 'classnames'

// 태그 컴포넌트의 CSS 클래스 접두사
const classPrefix = `adm-tag`

// 미리 정의된 색상 테마와 CSS 변수 매핑
// 설계 목적: 일관된 브랜드 색상 시스템 제공 및 테마 커스터마이징 지원
// CSS 변수 사용 이유: 런타임에서 테마 변경 가능, fallback 값으로 브라우저 호환성 보장
const colorRecord: Record<string, string> = {
  default: 'var(--adm-color-text-secondary, #666666)', // 기본 회색 - 중립적인 정보 표시
  primary: 'var(--adm-color-primary, #1677ff)', // 주 브랜드 색상 - 중요한 정보나 선택 상태
  success: 'var(--adm-color-success, #00b578)', // 성공/완료 상태 - 긍정적인 피드백
  warning: 'var(--adm-color-warning, #ff8f1f)', // 경고 상태 - 주의 필요한 정보
  danger: 'var(--adm-color-danger, #ff3141)', // 위험/오류 상태 - 부정적인 피드백이나 삭제 작업
}

// 태그 컴포넌트의 Props 타입 정의
export type TagProps = {
  color?: // 태그 색상 - 미리 정의된 테마 색상 또는 커스텀 색상값
  | 'default' // 기본 회색 테마
    | 'primary' // 주 브랜드 색상 테마
    | 'success' // 성공 색상 테마 (녹색 계열)
    | 'warning' // 경고 색상 테마 (주황색 계열)
    | 'danger' // 위험 색상 테마 (빨간색 계열)
    | (string & {}) // 타입스크립트 트릭: 자동완성은 유지하면서 임의의 문자열도 허용
  fill?: 'solid' | 'outline' // 채움 스타일 - 실선(배경색) 또는 외곽선(테두리만)
  round?: boolean // 둥근 모서리 여부 - 모바일에서 부드러운 느낌을 위한 옵션
  onClick?: (e: React.MouseEvent<HTMLSpanElement, MouseEvent>) => void // 클릭 이벤트 핸들러 - 상호작용 가능한 태그
  children?: ReactNode // 태그에 표시될 내용 (텍스트, 아이콘 등)
} & NativeProps<
  // CSS 커스텀 프로퍼티 지원으로 세밀한 스타일 제어 가능
  '--border-color' | '--background-color' | '--text-color' | '--border-radius'
>

// 기본 속성값 정의
const defaultProps = {
  color: 'default', // 기본적으로 중립적인 회색 테마 사용
  fill: 'solid', // 기본적으로 배경이 채워진 스타일
  round: false, // 기본적으로 직각 모서리 사용
}

// 태그 컴포넌트 메인 구현
// 설계 특징: 간단하면서도 유연한 라벨/상태 표시 컴포넌트
// 사용 시나리오: 카테고리 표시, 상태 라벨, 필터 태그, 배지 등
export const Tag: FC<TagProps> = p => {
  const props = mergeProps(defaultProps, p) // 기본 props와 사용자 props 병합

  // 색상 값 결정 로직
  // 1. colorRecord에 정의된 테마 색상인 경우 해당 CSS 변수 사용
  // 2. 커스텀 색상인 경우 그 값을 직접 사용 (예: '#ff0000', 'rgb(255,0,0)' 등)
  const color = colorRecord[props.color] ?? props.color

  // CSS 커스텀 프로퍼티를 통한 동적 스타일링
  // 장점: CSS-in-JS 없이도 동적 색상 적용 가능, 성능 최적화, 테마 시스템과 연동
  const style: CSSProperties & {
    '--border-color': string // 테두리 색상 CSS 변수
    '--text-color': string // 텍스트 색상 CSS 변수
    '--background-color': string // 배경색 CSS 변수
  } = {
    '--border-color': color, // 테두리는 항상 선택된 색상 사용
    // 텍스트 색상 결정 로직: outline 스타일이면 색상, solid 스타일이면 흰색
    '--text-color': props.fill === 'outline' ? color : '#ffffff',
    // 배경색 결정 로직: outline 스타일이면 투명, solid 스타일이면 색상
    '--background-color': props.fill === 'outline' ? 'transparent' : color,
  }

  return withNativeProps(
    props,
    <span
      style={style} // CSS 커스텀 프로퍼티 적용
      onClick={props.onClick} // 클릭 핸들러 연결
      className={classNames(classPrefix, {
        [`${classPrefix}-round`]: props.round, // 조건부 둥근 모서리 클래스 적용
      })}
    >
      {props.children} {/* 태그 내용 렌더링 */}
    </span>
  )
}
