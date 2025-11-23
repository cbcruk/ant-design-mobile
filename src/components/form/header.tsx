/**
 * Header 컴포넌트 - 폼 섹션 구분용 마커 컴포넌트
 *
 * [WHY] Form 내에서 섹션을 구분하기 위한 마커 역할
 * - 긴 폼을 논리적인 섹션으로 나누어 가독성 향상
 * - 예: "개인정보", "연락처", "추가 정보" 등의 섹션 구분
 *
 * [HOW] 특이한 구현 방식 - null을 반환하는 마커 컴포넌트:
 * 1. Header 컴포넌트 자체는 아무것도 렌더링하지 않음 (null 반환)
 * 2. Form 컴포넌트가 children을 순회하면서 Header 타입 감지
 * 3. Header를 만나면 새로운 List 섹션 시작, children을 헤더 텍스트로 사용
 *
 * [설계 패턴] "마커 컴포넌트" 패턴
 * - 컴포넌트가 직접 렌더링하지 않고 부모에게 메타 정보 전달
 * - 선언적인 API로 섹션 구조 정의 가능
 *
 * [사용 예]
 * <Form>
 *   <Form.Item ... />
 *   <Form.Header>연락처 정보</Form.Header>  // ← 여기서 새 섹션 시작
 *   <Form.Item ... />
 * </Form>
 */

import type { FC, ReactNode } from 'react'

/**
 * Header 컴포넌트 구현
 *
 * [주의사항]
 * - 반드시 Form 내부에서만 사용해야 함
 * - Form 외부에서 사용하면 아무것도 렌더링되지 않음
 *
 * [children] 섹션 헤더로 표시될 텍스트 또는 ReactNode
 */
export const Header: FC<{ children?: ReactNode }> = () => null
