import React, { isValidElement } from 'react'
import type { FC, ReactNode, ReactElement } from 'react'
import classNames from 'classnames'
import { NativeProps, withNativeProps } from '../../utils/native-props'
import { mergeProps } from '../../utils/with-default-props'
import Badge, { BadgeProps } from '../badge'
import SafeArea from '../safe-area'
import { usePropsValue } from '../../utils/use-props-value'
import { traverseReactNode } from '../../utils/traverse-react-node'

// TabBarItem 컴포넌트 Props 타입 정의
// why: 각 탭 아이템의 속성을 타입 안전하게 정의하여 런타임 에러 방지
// how: icon/title을 함수형으로 받아 활성 상태에 따른 동적 렌더링 지원
export type TabBarItemProps = {
  icon?: ReactNode | ((active: boolean) => ReactNode) // 아이콘: 정적 또는 상태별 동적 렌더링
  title?: ReactNode | ((active: boolean) => ReactNode) // 제목: 정적 또는 상태별 동적 렌더링
  badge?: BadgeProps['content'] // 배지: Badge 컴포넌트의 content 타입 재사용
  onClick?: () => void // 클릭 핸들러: 커스텀 동작 추가용
} & NativeProps

// TabBarItem 더미 컴포넌트: 실제 렌더링되지 않는 타입 추론용 컴포넌트
// why: React children으로 전달된 TabBarItem을 타입 체크하기 위한 마커 컴포넌트
// how: 실제로는 null을 반환하여 DOM에 영향 없이 타입 정보만 제공
/* istanbul ignore next */
export const TabBarItem: FC<TabBarItemProps> = () => {
  return null
}

// TabBar 메인 컴포넌트 Props 타입 정의
// why: 탭바의 상태 관리와 안전 영역 처리를 위한 속성들을 타입 안전하게 정의
// how: 제어/비제어 컴포넌트 패턴을 지원하며 모바일 환경의 안전 영역 고려
export type TabBarProps = {
  activeKey?: string | null // 현재 활성 탭 키 (제어 컴포넌트용)
  defaultActiveKey?: string | null // 초기 활성 탭 키 (비제어 컴포넌트용)
  onChange?: (key: string) => void // 탭 변경 시 호출되는 콜백 함수
  safeArea?: boolean // iPhone X 계열의 하단 안전 영역 처리 여부
  children?: ReactNode // TabBarItem 컴포넌트들을 포함한 자식 요소
} & NativeProps

// CSS 클래스 접두사: 컴포넌트 스타일링을 위한 네임스페이스
// why: CSS 클래스 충돌 방지와 일관된 네이밍 규칙 적용
const classPrefix = `adm-tab-bar`

// 기본 Props 값: 컴포넌트의 기본 동작 설정
// why: 대부분의 사용 사례에서 안전 영역이 불필요하므로 기본값을 false로 설정
const defaultProps = {
  safeArea: false,
}

// TabBar 메인 컴포넌트: 하단 탭 네비게이션 구현
// why: 모바일 앱의 주요 네비게이션 패턴인 하단 탭바를 웹에서 구현
// how: React children으로 전달된 TabBarItem들을 파싱하여 탭 인터페이스 생성
export const TabBar: FC<TabBarProps> = p => {
  // Props 병합: 기본값과 사용자 전달 Props를 조합
  // why: 기본 동작을 보장하면서도 사용자 커스터마이징 허용
  const props = mergeProps(defaultProps, p)

  // 첫 번째 탭의 키 추적: 기본 활성 탭 결정용
  // why: defaultActiveKey가 없을 때 첫 번째 탭을 기본 활성으로 설정
  let firstActiveKey: string | null = null

  // 유효한 TabBarItem 요소들을 저장할 배열
  // why: children에서 유효한 TabBarItem만 필터링하여 안전한 렌더링 보장
  const items: ReactElement<TabBarItemProps>[] = []

  // React children 순회: TabBarItem 컴포넌트들을 수집 및 검증
  // why: JSX에서 전달된 children이 유효한 TabBarItem인지 확인하고 key 추출 필요
  // how: traverseReactNode로 중첩 구조도 안전하게 처리
  traverseReactNode(props.children, (child, index) => {
    // React 요소 유효성 검사: TabBarItem 타입인지 확인
    // why: 잘못된 자식 요소가 전달되어도 런타임 에러 방지
    if (!isValidElement<TabBarItemProps>(child)) return

    // 키 추출 및 타입 검사: 문자열 키만 허용
    // why: 탭 식별을 위해 문자열 키가 필수이며, React의 key prop 활용
    const key = child.key
    if (typeof key !== 'string') return

    // 첫 번째 아이템의 키 저장: 기본 활성 탭 설정용
    // why: 명시적 defaultActiveKey가 없을 때 첫 번째 탭을 기본으로 활성화
    if (index === 0) {
      firstActiveKey = key
    }

    // 유효한 아이템을 배열에 추가
    items.push(child)
  })

  // 활성 탭 상태 관리: 제어/비제어 컴포넌트 패턴 지원
  // why: activeKey prop이 있으면 제어 컴포넌트, 없으면 비제어 컴포넌트로 동작
  // how: usePropsValue 훅으로 두 패턴을 통합하여 처리
  const [activeKey, setActiveKey] = usePropsValue({
    value: props.activeKey, // 제어 컴포넌트: 외부에서 상태 관리
    defaultValue: props.defaultActiveKey ?? firstActiveKey, // 비제어 컴포넌트: 내부에서 상태 관리
    onChange: v => {
      // null 값 필터링: 유효한 키만 onChange로 전달
      // why: null 활성 키는 의미가 없으므로 콜백 호출하지 않음
      if (v === null) return
      props.onChange?.(v)
    },
  })

  // 컴포넌트 렌더링: 네이티브 Props와 함께 탭바 구조 생성
  // why: withNativeProps로 CSS 변수와 클래스명을 안전하게 적용
  return withNativeProps(
    props,
    <div className={classPrefix}>
      {/* 탭 아이템들을 감싸는 컨테이너 */}
      <div className={`${classPrefix}-wrap`}>
        {/* 각 탭 아이템 렌더링: 수집된 유효한 아이템들을 순회 */}
        {items.map(item => {
          // 현재 아이템의 활성 상태 판단
          // why: 활성 탭에 따른 시각적 피드백과 동적 콘텐츠 렌더링 필요
          const active = item.key === activeKey

          // 탭 아이템 콘텐츠 렌더링 함수: 아이콘과 제목의 조합 처리
          // why: 아이콘/제목의 존재 여부와 Badge 적용 위치에 따른 복잡한 렌더링 로직 분리
          function renderContent() {
            // 아이콘 요소 렌더링: 정적/동적 아이콘 처리
            // why: 활성 상태에 따라 다른 아이콘을 표시하는 기능 지원
            // how: 함수형 아이콘이면 active 상태를 전달하여 호출
            const iconElement = item.props.icon && (
              <div className={`${classPrefix}-item-icon`}>
                {typeof item.props.icon === 'function'
                  ? item.props.icon(active)
                  : item.props.icon}
              </div>
            )

            // 제목 요소 렌더링: 정적/동적 제목 처리
            // why: 활성 상태에 따라 다른 제목을 표시하는 기능 지원
            // how: 아이콘 존재 여부에 따른 CSS 클래스 조건부 적용
            const titleElement = item.props.title && (
              <div
                className={classNames(
                  `${classPrefix}-item-title`,
                  Boolean(iconElement) && `${classPrefix}-item-title-with-icon`
                )}
              >
                {typeof item.props.title === 'function'
                  ? item.props.title(active)
                  : item.props.title}
              </div>
            )
            // 렌더링 우선순위에 따른 콘텐츠 구성
            // why: 아이콘과 제목의 조합에 따라 Badge 적용 위치가 달라짐
            if (iconElement) {
              // 아이콘이 있는 경우: 아이콘에 Badge 적용하고 제목은 별도 표시
              // why: 시각적으로 아이콘이 더 돋보이므로 Badge를 아이콘에 부착
              return (
                <>
                  <Badge
                    content={item.props.badge}
                    className={`${classPrefix}-icon-badge`}
                  >
                    {iconElement}
                  </Badge>
                  {titleElement}
                </>
              )
            } else if (titleElement) {
              // 제목만 있는 경우: 제목에 Badge 적용
              // why: 아이콘이 없으면 제목이 유일한 식별 요소이므로 Badge를 제목에 부착
              return (
                <Badge
                  content={item.props.badge}
                  className={`${classPrefix}-title-badge`}
                >
                  {titleElement}
                </Badge>
              )
            }
            // 아이콘과 제목이 모두 없는 경우: 빈 콘텐츠 반환
            // why: 빈 탭은 의미가 없지만 크래시를 방지하기 위해 null 반환
            return null
          }

          // 개별 탭 아이템 컨테이너 렌더링: 클릭 이벤트와 스타일 적용
          // why: 각 탭의 상호작용과 시각적 상태를 관리하는 래퍼 요소 필요
          return withNativeProps(
            item.props,
            <div
              key={item.key}
              onClick={() => {
                // 탭 클릭 이벤트 처리: 활성 탭 변경 및 커스텀 핸들러 호출
                const { key } = item

                // 유효하지 않은 키 필터링: undefined/null 키는 무시
                // why: 키가 없는 탭은 식별할 수 없으므로 상태 변경 불가
                if (key === undefined || key === null) return

                // 활성 탭 상태 업데이트: 문자열로 변환하여 저장
                // why: React key는 다양한 타입이지만 내부적으로는 문자열로 관리
                setActiveKey(key.toString())

                // 커스텀 클릭 핸들러 실행: 사용자 정의 동작 지원
                // why: 탭 변경 외에 추가적인 비즈니스 로직 실행 가능
                item.props.onClick?.()
              }}
              className={classNames(`${classPrefix}-item`, {
                [`${classPrefix}-item-active`]: active, // 활성 상태에 따른 조건부 클래스
              })}
            >
              {renderContent()}
            </div>
          )
        })}
      </div>

      {/* 안전 영역 처리: iPhone X 계열의 하단 홈 인디케이터 영역 대응 */}
      {/* why: 탭바가 하단에 위치할 때 홈 인디케이터와 겹치는 문제 방지 */}
      {props.safeArea && <SafeArea position='bottom' />}
    </div>
  )
}
