import React from 'react'

// 드롭다운 아이콘 컨텍스트 생성
// 목적: 부모 Dropdown 컴포넌트에서 설정한 화살표 아이콘을 모든 하위 DropdownItem에 전달
// 설계 배경: React Context API를 활용하여 prop drilling 없이 아이콘을 공유
// 사용 시나리오: Dropdown 레벨에서 통일된 화살표 아이콘을 설정하면 모든 아이템이 동일한 아이콘 사용
export const IconContext = React.createContext<React.ReactNode>(null) // null 초기값으로 아이콘 미설정 상태 표현
