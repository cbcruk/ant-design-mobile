/**
 * FormArray 컴포넌트
 *
 * [WHY] 동적 필드 배열을 관리하기 위한 컴포넌트
 * - 반복되는 폼 필드 그룹을 동적으로 추가/삭제/이동 가능
 * - 예: 가족 구성원 목록, 교육 이력, 경력 사항 등
 *
 * [HOW] rc-field-form의 List 컴포넌트를 래핑하여 ant-design-mobile 스타일 적용
 * - 각 필드 그룹을 카드 형태의 List로 렌더링
 * - 추가 버튼 UI 제공
 *
 * [구현 난이도: 중간]
 * - render props 패턴으로 유연한 커스터마이징 지원
 */

import React from 'react'
import type { FC, ReactNode, ReactElement } from 'react'
import type { StoreValue } from 'rc-field-form/es/interface'
// [WHY] rc-field-form의 List: 동적 필드 배열 상태 관리
// 필드 추가/삭제/이동 시 폼 상태를 자동으로 동기화
import { List as RCList } from 'rc-field-form'
import List from '../list'

/**
 * FormArrayField - 배열 내 개별 필드 정보
 *
 * [속성]
 * - index: 배열에서의 인덱스 (FormItem의 name에 사용)
 * - key: React key로 사용할 고유 값 (리렌더링 최적화)
 */
export interface FormArrayField {
  index: number
  key: number
}

/**
 * FormArrayOperation - 배열 조작 API
 *
 * [WHY] 외부에서 동적 필드 배열을 제어하기 위한 인터페이스
 * [메서드]
 * - add: 새 필드 추가 (기본값, 삽입 위치 지정 가능)
 * - remove: 필드 삭제 (단일 또는 복수 인덱스)
 * - move: 필드 위치 이동
 */
export interface FormArrayOperation {
  add: (defaultValue?: StoreValue, insertIndex?: number) => void
  remove: (index: number | number[]) => void
  move: (from: number, to: number) => void
}

/**
 * FormArrayProps - FormArray 컴포넌트의 Props
 *
 * [주요 props]
 * - name: 폼 데이터에서의 필드 경로
 * - children: render props 함수 (필드 목록과 조작 API 제공)
 * - renderHeader: 각 필드 그룹의 헤더 렌더링 (삭제 버튼 등)
 * - renderAdd: 추가 버튼 렌더링
 * - onAdd: 추가 버튼 클릭 시 커스텀 동작
 */
export interface FormArrayProps {
  name: string | number | (string | number)[] // 필드 경로 (예: 'members' 또는 ['user', 'addresses'])
  initialValue?: any[] // 초기값 배열
  renderHeader?: (
    field: FormArrayField,
    operation: FormArrayOperation
  ) => ReactNode // 각 항목의 헤더 (예: "항목 1", 삭제 버튼)
  onAdd?: (operation: FormArrayOperation) => void // 추가 버튼 커스텀 핸들러
  renderAdd?: () => ReactNode // 추가 버튼 UI
  children: (
    fields: FormArrayField[],
    operation: FormArrayOperation
  ) => ReactElement[] // render props: 필드 목록 렌더링
}

/**
 * FormArray 컴포넌트 구현
 *
 * [사용 예]
 * <Form.Array name="members" renderAdd={() => '+ 추가'}>
 *   {(fields, { remove }) => fields.map(field => (
 *     <Form.Item name={[field.index, 'name']} label="이름">
 *       <Input />
 *     </Form.Item>
 *   ))}
 * </Form.Array>
 */
export const FormArray: FC<FormArrayProps> = props => {
  return (
    // [HOW] rc-field-form의 List로 동적 필드 배열 상태 관리
    <RCList name={props.name} initialValue={props.initialValue}>
      {(rcFields, operation) => {
        /**
         * [HOW] rc-field-form의 필드를 FormArrayField 형태로 변환
         * - field.name → index (필드 경로에 사용)
         * - field.key → key (React key)
         */
        const fields = rcFields.map(field => ({
          index: field.name,
          key: field.key,
        }))

        /**
         * [HOW] 각 필드를 카드 형태의 List로 감싸서 렌더링
         * - mode='card': 카드 스타일로 시각적 구분
         * - renderHeader로 각 카드의 헤더 렌더링 (삭제 버튼 등)
         */
        const children = props
          .children(fields, operation)
          .map((child, index) => (
            <List
              key={fields[index].key}
              mode='card'
              header={props.renderHeader?.(fields[index], operation)}
            >
              {child}
            </List>
          ))

        /**
         * [HOW] renderAdd가 있으면 추가 버튼 UI 렌더링
         * - onAdd가 있으면 커스텀 핸들러 호출
         * - 없으면 기본 operation.add() 호출
         */
        if (props.renderAdd) {
          children.push(
            <List key='add' mode='card'>
              <List.Item
                className='adm-form-list-operation'
                onClick={() => {
                  props.onAdd ? props.onAdd(operation) : operation.add()
                }}
                arrow={false}
              >
                {props.renderAdd()}
              </List.Item>
            </List>
          )
        }

        return <>{children}</>
      }}
    </RCList>
  )
}
