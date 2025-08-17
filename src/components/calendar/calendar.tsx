import { useUpdateEffect } from 'ahooks'
import classNames from 'classnames'
import dayjs from 'dayjs'
import isoWeek from 'dayjs/plugin/isoWeek'
import React, {
  forwardRef,
  ReactNode,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react'
import { devWarning } from '../../utils/dev-log'
import { NativeProps, withNativeProps } from '../../utils/native-props'
import { replaceMessage } from '../../utils/replace-message'
import { usePropsValue } from '../../utils/use-props-value'
import { mergeProps } from '../../utils/with-default-props'
import { useConfig } from '../config-provider'
import { ArrowLeft } from './arrow-left'
import { ArrowLeftDouble } from './arrow-left-double'
import {
  convertPageToDayjs,
  convertValueToRange,
  DateRange,
  Page,
} from './convert'

dayjs.extend(isoWeek)

const classPrefix = 'adm-calendar'

export type CalendarRef = {
  jumpTo: (page: Page | ((page: Page) => Page)) => void
  jumpToToday: () => void
}

export type CalendarProps = {
  prevMonthButton?: React.ReactNode
  prevYearButton?: React.ReactNode
  nextMonthButton?: React.ReactNode
  nextYearButton?: React.ReactNode
  onPageChange?: (year: number, month: number) => void
  weekStartsOn?: 'Monday' | 'Sunday'
  renderLabel?: (date: Date) => React.ReactNode
  renderDate?: (date: Date) => React.ReactNode
  cellRender?: (oriNode: React.ReactElement, info: { date: Date }) => ReactNode
  allowClear?: boolean
  max?: Date
  min?: Date
  shouldDisableDate?: (date: Date) => boolean
  minPage?: Page
  maxPage?: Page
} & (
  | {
      selectionMode?: undefined
      value?: undefined
      defaultValue?: undefined
      onChange?: undefined
    }
  | {
      selectionMode: 'single'
      value?: Date | null
      defaultValue?: Date | null
      onChange?: (val: Date | null) => void
    }
  | {
      selectionMode: 'range'
      value?: [Date, Date] | null
      defaultValue?: [Date, Date] | null
      onChange?: (val: [Date, Date] | null) => void
    }
) &
  NativeProps

const defaultProps = {
  weekStartsOn: 'Sunday',
  defaultValue: null,
  allowClear: true,
  prevMonthButton: <ArrowLeft />,
  prevYearButton: <ArrowLeftDouble />,
  nextMonthButton: <ArrowLeft />,
  nextYearButton: <ArrowLeftDouble />,
}

// 캘린더 컴포넌트 - dayjs 기반 정교한 날짜 계산과 다중 선택 모드를 지원하는 고도화된 날짜 선택 인터페이스
// 설계 의도: 국제화된 날짜 시스템과 다양한 문화권의 주 시작일을 고려한 글로벌 달력 구현
// 핵심 특징: 단일/범위 선택, 커스텀 렌더링, 날짜 제한, 주간/월간 네비게이션
export const Calendar = forwardRef<CalendarRef, CalendarProps>((p, ref) => {
  const today = dayjs() // 현재 날짜 기준점: 오늘 강조 표시와 기본 위치 설정용
  const props = mergeProps(defaultProps, p)
  const { locale } = useConfig()

  // 주간 표시 라벨 국제화: 지역별 요일 표기와 주 시작일 설정
  // 핵심 설계: 서구권(일요일 시작) vs 동양권(월요일 시작)의 문화적 차이 반영
  const markItems = [...locale.Calendar.markItems] // 요일 라벨 배열 복사
  if (props.weekStartsOn === 'Sunday') {
    // 일요일 시작: 마지막 요소(토요일)를 맨 앞으로 이동하여 일~토 순서 구성
    const item = markItems.pop() // 마지막 요소 추출
    if (item) markItems.unshift(item) // 맨 앞에 삽입
  }
  // 월요일 시작은 기본 순서(월~일) 유지

  // 선택된 날짜 범위 상태: 단일/범위 선택을 통합 관리하는 정규화된 상태
  // 설계 철학: 내부적으로는 항상 [시작일, 종료일] 배열로 처리하여 코드 일관성 확보
  // 단일 선택도 [date, date] 형태로 저장하여 범위 선택과 동일한 로직 사용 가능
  const [dateRange, setDateRange] = usePropsValue<DateRange>({
    value:
      props.value === undefined
        ? undefined
        : convertValueToRange(props.selectionMode, props.value), // 외부 값을 내부 형식으로 변환
    defaultValue: convertValueToRange(props.selectionMode, props.defaultValue),
    onChange: v => {
      // 내부 형식을 외부 API 형식으로 역변환하여 onChange 호출
      if (props.selectionMode === 'single') {
        props.onChange?.(v ? v[0] : null) // 범위의 첫 번째 날짜만 반환
      } else if (props.selectionMode === 'range') {
        props.onChange?.(v) // 전체 범위 반환
      }
    },
  })

  // 범위 선택 중간 상태: 시작일은 선택했지만 종료일을 아직 선택하지 않은 상태
  // 문제: 범위 선택에서 첫 번째 클릭 후 두 번째 클릭까지의 사용자 경험 관리 필요
  // 해결: intermediate 플래그로 "첫 번째 날짜 선택 완료, 두 번째 날짜 대기 중" 상태 추적
  const [intermediate, setIntermediate] = useState(false)

  // 현재 표시 중인 월/년: 달력에서 보여주는 페이지의 기준 날짜
  // 핵심 설계: 선택된 날짜가 있으면 해당 월을 표시, 없으면 오늘이 속한 월 표시
  // date(1): 매월 1일로 정규화하여 월 단위 네비게이션의 기준점 설정
  const [current, setCurrent] = useState(() =>
    dayjs(dateRange ? dateRange[0] : today).date(1)
  )

  useUpdateEffect(() => {
    props.onPageChange?.(current.year(), current.month() + 1)
  }, [current])

  useImperativeHandle(ref, () => ({
    jumpTo: pageOrPageGenerator => {
      let page: Page
      if (typeof pageOrPageGenerator === 'function') {
        page = pageOrPageGenerator({
          year: current.year(),
          month: current.month() + 1,
        })
      } else {
        page = pageOrPageGenerator
      }
      setCurrent(convertPageToDayjs(page))
    },
    jumpToToday: () => {
      setCurrent(dayjs().date(1))
    },
  }))

  // 페이지 네비게이션 핸들러: 월/년 단위 이동과 범위 제한을 통합 처리
  // 설계 의도: 사용자가 불필요한 과거/미래 월로 이동하는 것을 방지하여 UX 향상
  // 복잡성 이유: 월 이동과 년 이동의 경계 조건이 다르고, 각각에 대한 제한 검사 필요
  const handlePageChange = (
    action: 'subtract' | 'add', // 이전/다음 방향
    num: number, // 이동할 단위 수
    type: 'month' | 'year' // 월 단위 vs 년 단위
  ) => {
    // dayjs 체이닝으로 새로운 날짜 계산
    const nxtCurrent = current[action](num, type)

    // 최소 페이지 제한: 설정된 최소 월/년보다 이전으로 이동 방지
    if (action === 'subtract' && props.minPage) {
      const minPage = convertPageToDayjs(props.minPage)
      if (nxtCurrent.isBefore(minPage, type)) {
        return // 제한 범위를 벗어나면 이동 취소
      }
    }

    // 최대 페이지 제한: 설정된 최대 월/년보다 이후로 이동 방지
    if (action === 'add' && props.maxPage) {
      const maxPage = convertPageToDayjs(props.maxPage)
      if (nxtCurrent.isAfter(maxPage, type)) {
        return // 제한 범위를 벗어나면 이동 취소
      }
    }

    setCurrent(nxtCurrent) // 제한 통과 시에만 실제 페이지 이동
  }

  const header = (
    <div className={`${classPrefix}-header`}>
      <a
        className={`${classPrefix}-arrow-button ${classPrefix}-arrow-button-year`}
        onClick={() => {
          handlePageChange('subtract', 1, 'year')
        }}
      >
        {props.prevYearButton}
      </a>
      <a
        className={`${classPrefix}-arrow-button ${classPrefix}-arrow-button-month`}
        onClick={() => {
          handlePageChange('subtract', 1, 'month')
        }}
      >
        {props.prevMonthButton}
      </a>
      <div className={`${classPrefix}-title`}>
        {replaceMessage(locale.Calendar.yearAndMonth, {
          year: current.year().toString(),
          month: (current.month() + 1).toString(),
        })}
      </div>
      <a
        className={classNames(
          `${classPrefix}-arrow-button`,
          `${classPrefix}-arrow-button-right`,
          `${classPrefix}-arrow-button-right-month`
        )}
        onClick={() => {
          handlePageChange('add', 1, 'month')
        }}
      >
        {props.nextMonthButton}
      </a>
      <a
        className={classNames(
          `${classPrefix}-arrow-button`,
          `${classPrefix}-arrow-button-right`,
          `${classPrefix}-arrow-button-right-year`
        )}
        onClick={() => {
          handlePageChange('add', 1, 'year')
        }}
      >
        {props.nextYearButton}
      </a>
    </div>
  )

  const maxDay = useMemo(() => props.max && dayjs(props.max), [props.max])
  const minDay = useMemo(() => props.min && dayjs(props.min), [props.min])

  // 달력 셀 렌더링 함수: 6x7 그리드에 날짜를 배치하는 복잡한 계산 로직
  // 설계 철학: 월의 시작/끝과 무관하게 항상 42개(6주 x 7일) 셀을 채워 일관된 레이아웃 유지
  // 복잡성 이유: 이전/다음 월 날짜 포함, 주 시작일 설정, 선택 상태 계산, 범위 표시 등 다중 로직 처리
  function renderCells() {
    const cells: ReactNode[] = []

    // 달력 시작점 계산: 현재 월의 첫 주 월요일부터 시작 (isoWeekday 기준)
    // isoWeekday(): 월요일=1, 일요일=7 (ISO 8601 표준)
    let iterator = current.subtract(current.isoWeekday(), 'day')

    // 주 시작일이 월요일인 경우: 기본 ISO 주간 기준 사용
    // 주 시작일이 일요일인 경우: 하루 앞당겨서 일요일부터 시작하도록 조정
    if (props.weekStartsOn === 'Monday') {
      iterator = iterator.add(1, 'day') // 월요일 시작으로 조정
    }
    // Sunday 시작은 기본 계산 결과 사용 (일요일부터 시작)
    // 6주 x 7일 = 42개 셀 생성 루프
    while (cells.length < 6 * 7) {
      const d = iterator // 현재 처리 중인 날짜

      // 선택 상태 플래그들: 복잡한 범위 선택 시각화를 위한 상태 변수들
      let isSelect = false // 선택된 범위에 포함되는가
      let isBegin = false // 범위 시작일인가
      let isEnd = false // 범위 종료일인가
      let isSelectRowBegin = false // 행의 첫 번째 선택 셀인가 (좌측 둥근 모서리용)
      let isSelectRowEnd = false // 행의 마지막 선택 셀인가 (우측 둥근 모서리용)

      if (dateRange) {
        const [begin, end] = dateRange

        // 기본 선택 상태 계산: 시작일, 종료일, 중간 날짜 판별
        isBegin = d.isSame(begin, 'day')
        isEnd = d.isSame(end, 'day')
        isSelect =
          isBegin ||
          isEnd ||
          (d.isAfter(begin, 'day') && d.isBefore(end, 'day')) // 시작일과 종료일 사이

        // 행 경계 선택 상태: 범위 선택 시 각 행의 양 끝에서 시각적 처리를 위한 계산
        // 문제: 범위 선택이 여러 주에 걸칠 때 각 행의 시작/끝에서 둥근 모서리 표시 필요
        // 해결: 주의 첫날(cells.length % 7 === 0) 또는 월의 첫날, 그리고 실제 범위 시작일이 아닌 경우
        if (isSelect) {
          isSelectRowBegin =
            (cells.length % 7 === 0 || d.isSame(d.startOf('month'), 'day')) &&
            !isBegin // 실제 범위 시작일이 아닌 경우에만
          isSelectRowEnd =
            (cells.length % 7 === 6 || d.isSame(d.endOf('month'), 'day')) &&
            !isEnd // 실제 범위 종료일이 아닌 경우에만
        }
      }
      // 월 소속 여부: 현재 표시 중인 월에 속하는 날짜인지 확인
      // 용도: 이전/다음 월 날짜는 흐리게 표시하고 클릭 시 해당 월로 이동
      const inThisMonth = d.month() === current.month()

      // 비활성화 조건 계산: 커스텀 조건과 기본 날짜 범위 제한을 통합 처리
      // 우선순위: 사용자 정의 shouldDisableDate > 기본 min/max 범위 제한
      const disabled = props.shouldDisableDate
        ? props.shouldDisableDate(d.toDate()) // 커스텀 비활성화 로직 우선 적용
        : (maxDay && d.isAfter(maxDay, 'day')) || // 최대 날짜 초과
          (minDay && d.isBefore(minDay, 'day')) // 최소 날짜 미만

      const originalCell = (
        <div
          key={d.valueOf()}
          className={classNames(
            `${classPrefix}-cell`,
            (disabled || !inThisMonth) && `${classPrefix}-cell-disabled`,
            inThisMonth && {
              [`${classPrefix}-cell-today`]: d.isSame(today, 'day'),
              [`${classPrefix}-cell-selected`]: isSelect,
              [`${classPrefix}-cell-selected-begin`]: isBegin,
              [`${classPrefix}-cell-selected-end`]: isEnd,
              [`${classPrefix}-cell-selected-row-begin`]: isSelectRowBegin,
              [`${classPrefix}-cell-selected-row-end`]: isSelectRowEnd,
            }
          )}
          onClick={() => {
            if (!props.selectionMode) return
            if (disabled) return
            const date = d.toDate()
            // 다른 월 날짜 클릭 시 해당 월로 네비게이션
            // 설계 의도: 사용자가 이전/다음 월의 흐린 날짜를 클릭하면 해당 월로 이동하여 명확한 선택 가능
            if (!inThisMonth) {
              setCurrent(d.clone().date(1)) // 클릭한 날짜의 월로 이동 (1일 기준)
            }
            // 선택 해제 조건 검사: 클릭한 날짜가 현재 선택과 정확히 일치하는지 확인
            // 핵심 설계: allowClear 옵션과 동일 날짜 재클릭을 통한 토글 기능 제공
            function shouldClear() {
              if (!props.allowClear) return false // 선택 해제 기능이 비활성화된 경우
              if (!dateRange) return false // 현재 선택된 날짜가 없는 경우

              const [begin, end] = dateRange
              // 단일 선택이거나 시작일=종료일인 범위에서 동일 날짜 클릭 시에만 해제
              // 주의: 'date'와 'day' 비교 단위가 다름 (원본 코드의 잠재적 버그 가능성)
              return d.isSame(begin, 'date') && d.isSame(end, 'day')
            }
            // 선택 모드별 클릭 처리: 단일 선택과 범위 선택의 서로 다른 상호작용 로직
            if (props.selectionMode === 'single') {
              // 단일 선택 모드: 클릭한 날짜를 즉시 선택, allowClear 옵션에 따라 토글 가능
              if (props.allowClear && shouldClear()) {
                setDateRange(null) // 같은 날짜 재클릭 시 선택 해제
                return
              }
              setDateRange([date, date]) // 새 날짜 선택 (시작일=종료일)
            } else if (props.selectionMode === 'range') {
              // 범위 선택 모드: 2단계 선택 과정과 중간 상태 관리
              if (!dateRange) {
                // 첫 번째 선택: 시작일 설정하고 종료일 대기 상태로 전환
                setDateRange([date, date])
                setIntermediate(true) // "두 번째 날짜 선택 대기" 상태
                return
              }

              if (shouldClear()) {
                // 완성된 범위에서 동일 날짜 클릭 시 전체 선택 해제
                setDateRange(null)
                setIntermediate(false)
                return
              }

              if (intermediate) {
                // 두 번째 선택: 기존 시작일과 새 종료일로 범위 완성
                const another = dateRange[0] // 첫 번째로 선택된 날짜
                // 날짜 순서 자동 정렬: 늦은 날짜를 먼저 클릭해도 올바른 순서로 저장
                setDateRange(another > date ? [date, another] : [another, date])
                setIntermediate(false) // 범위 선택 완료
              } else {
                // 완성된 범위에서 새 날짜 클릭: 새로운 범위 선택 시작
                setDateRange([date, date])
                setIntermediate(true)
              }
            }
          }}
        >
          <div className={`${classPrefix}-cell-top`}>
            {props.renderDate ? props.renderDate(d.toDate()) : d.date()}
          </div>
          <div className={`${classPrefix}-cell-bottom`}>
            {props.renderLabel?.(d.toDate())}
          </div>
        </div>
      )

      // Wrap with Fragment to ensure key is properly set
      const cellWithKey = props.cellRender ? (
        <React.Fragment key={d.valueOf()}>
          {props.cellRender(originalCell, { date: d.toDate() })}
        </React.Fragment>
      ) : (
        originalCell
      )

      cells.push(cellWithKey)
      iterator = iterator.add(1, 'day')
    }
    return cells
  }
  const body = <div className={`${classPrefix}-cells`}>{renderCells()}</div>

  const mark = (
    <div className={`${classPrefix}-mark`}>
      {markItems.map((item, index) => (
        <div key={index} className={`${classPrefix}-mark-cell`}>
          {item}
        </div>
      ))}
    </div>
  )

  // Dev only warning
  if (process.env.NODE_ENV !== 'production') {
    useEffect(() => {
      devWarning(
        'Calendar',
        'Calendar will be removed in the future, please use CalendarPickerView instead.'
      )
    }, [])
  }

  return withNativeProps(
    props,
    <div className={classPrefix}>
      {header}
      {mark}
      {body}
    </div>
  )
})
