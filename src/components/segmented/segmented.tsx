import classNames from 'classnames'
import type {
  SegmentedLabeledOption as RcSegmentedLabeledOption,
  SegmentedProps as RCSegmentedProps,
  SegmentedRawOption,
} from 'rc-segmented'
import RcSegmented from 'rc-segmented'
import * as React from 'react'

import { NativeProps, withNativeProps } from '../../utils/native-props'

export type { SegmentedValue } from 'rc-segmented'

interface SegmentedLabeledOptionWithoutIcon extends RcSegmentedLabeledOption {
  label: RcSegmentedLabeledOption['label']
}

interface SegmentedLabeledOptionWithIcon
  extends Omit<RcSegmentedLabeledOption, 'label'> {
  label?: RcSegmentedLabeledOption['label']
  /** Set icon for Segmented item */
  icon: React.ReactNode
}

function isSegmentedLabeledOptionWithIcon(
  option:
    | SegmentedRawOption
    | SegmentedLabeledOptionWithIcon
    | SegmentedLabeledOptionWithoutIcon
): option is SegmentedLabeledOptionWithIcon {
  return (
    typeof option === 'object' &&
    !!(option as SegmentedLabeledOptionWithIcon)?.icon
  )
}

export type SegmentedLabeledOption =
  | SegmentedLabeledOptionWithIcon
  | SegmentedLabeledOptionWithoutIcon

interface InternalSegmentedProps
  extends Omit<RCSegmentedProps, 'size' | 'options'> {
  options: (SegmentedRawOption | SegmentedLabeledOption)[]
  /** Option to fit width to its parent's width */
  block?: boolean
}

export type SegmentedProps = InternalSegmentedProps &
  NativeProps<
    | '--segmented-background'
    | '--segmented-item-color'
    | '--segmented-item-selected-background'
    | '--segmented-item-selected-color'
    | '--segmented-item-disabled-color'
  >

const classPrefix = `adm-segmented`

// 세그먼트 컨트롤 컴포넌트 - 상호 배타적 선택을 위한 탭 스타일 선택 인터페이스
// 설계 의도: iOS/Android의 네이티브 세그먼트 컨트롤과 유사한 UX 제공
// 핵심 특징: 아이콘 지원 문법 설탕, rc-segmented 기반 확장, 블록 레이아웃 지원
const Segmented = React.forwardRef<HTMLDivElement, SegmentedProps>(
  (props, ref) => {
    const {
      prefixCls: customizePrefixCls,
      className,
      block, // 부모 너비에 맞춤: 전체 너비 사용 여부
      options = [],
      ...restProps
    } = props

    // 아이콘 지원을 위한 옵션 변환: rc-segmented에서 지원하지 않는 icon prop을 label로 변환
    // 핵심 설계: 사용자 친화적 API를 내부적으로 rc-segmented 호환 형태로 변환
    // 변환 과정: { icon, label } → { label: <아이콘+텍스트 조합> }
    const extendedOptions = React.useMemo<RCSegmentedProps['options']>(
      () =>
        options.map(option => {
          // 아이콘이 있는 옵션 처리: 아이콘과 텍스트를 조합한 label 생성
          if (isSegmentedLabeledOptionWithIcon(option)) {
            const { icon, label, ...restOption } = option
            return {
              ...restOption,
              // 아이콘+텍스트 조합 렌더링: 일관된 레이아웃과 스타일 적용
              label: (
                <>
                  <span className={`${classPrefix}-item-icon`}>{icon}</span>
                  {label && <span>{label}</span>}
                </>
              ),
            }
          }
          // 일반 옵션은 그대로 전달
          return option
        }),
      [options, classPrefix] // options와 classPrefix 변경 시에만 재계산
    )

    return withNativeProps(
      props,
      <RcSegmented
        {...restProps}
        className={classNames(className, {
          [`${classPrefix}-block`]: block,
        })}
        options={extendedOptions}
        ref={ref}
        prefixCls={classPrefix}
      />
    )
  }
)

if (process.env.NODE_ENV !== 'production') {
  Segmented.displayName = 'Segmented'
}

export { Segmented }
