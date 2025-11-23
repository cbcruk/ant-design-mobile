/**
 * Form 모듈 - 엔트리 포인트
 *
 * [WHY] Form 관련 모든 컴포넌트와 타입을 하나의 모듈로 통합 export
 * - 사용자가 Form.Item, Form.Header 등으로 일관된 API 사용 가능
 * - 필요한 타입만 선택적으로 import 가능
 *
 * [HOW] attachPropertiesToComponent 유틸리티로 Form에 서브 컴포넌트 부착
 * - Form.Item, Form.Header, Form.Array, Form.Subscribe 등
 * - Form.useForm, Form.useWatch 훅도 제공
 *
 * [API 구조]
 * Form (기본 export)
 *   ├── Item: 개별 폼 필드
 *   ├── Header: 섹션 구분 마커
 *   ├── Array: 동적 필드 배열
 *   ├── Subscribe: 필드 값 구독
 *   ├── useForm: 폼 인스턴스 생성 훅
 *   └── useWatch: 필드 값 변경 감지 훅
 */

import './index.less'
import { Form } from './form'
// [WHY] attachPropertiesToComponent: 컴포넌트에 정적 프로퍼티 부착
// Form.Item, Form.Header 등의 API 구현
import { attachPropertiesToComponent } from '../../utils/attach-properties-to-component'
import { FormItem } from './form-item'
import { Header } from './header'
// [WHY] rc-field-form의 훅 re-export
// - useForm: 폼 인스턴스 생성 (외부에서 폼 제어용)
// - useWatch: 특정 필드 값 변경 구독
import { useWatch, useForm } from 'rc-field-form'
import { FormSubscribe } from './form-subscribe'
import { FormArray } from './form-array'

// ============================================
// 타입 정의 exports
// ============================================

/**
 * FormLayout - 폼 레이아웃 방향
 * - 'vertical': 라벨이 입력 필드 위에 (모바일 기본)
 * - 'horizontal': 라벨이 입력 필드 왼쪽에
 */
export type FormLayout = 'vertical' | 'horizontal'

// Form 컴포넌트 관련 타입
export type { FormProps, FormInstance } from './form'
export type { FormItemProps } from './form-item'
export type { FormSubscribeProps } from './form-subscribe'

// rc-field-form 타입 re-export (사용자 편의)
export type {
  ValidateMessages, // 유효성 검사 메시지 커스터마이징
  FieldData, // 필드 데이터 (setFields용)
  NamePath, // 필드 경로 (string | number | (string | number)[])
  Rule, // 유효성 검사 규칙
  RuleObject, // 규칙 객체 형태
  RuleRender, // 규칙 렌더 함수 형태
} from 'rc-field-form/es/interface'

// FormArray 관련 타입
export type {
  FormArrayField,
  FormArrayOperation,
  FormArrayProps,
} from './form-array'

// ============================================
// 기본 export - Form 컴포넌트 + 서브 컴포넌트
// ============================================

/**
 * [HOW] attachPropertiesToComponent로 Form에 서브 컴포넌트/훅 부착
 *
 * [사용 예]
 * import Form from 'antd-mobile/es/components/form'
 *
 * <Form>
 *   <Form.Header>개인정보</Form.Header>
 *   <Form.Item name="username" label="이름">
 *     <Input />
 *   </Form.Item>
 * </Form>
 *
 * const [form] = Form.useForm()
 */
export default attachPropertiesToComponent(Form, {
  Item: FormItem, // 개별 폼 필드
  Subscribe: FormSubscribe, // 필드 값 구독
  Header, // 섹션 구분 마커
  Array: FormArray, // 동적 필드 배열
  useForm, // 폼 인스턴스 생성 훅
  useWatch, // 필드 값 변경 감지 훅
})
