import './tag.less' // 태그 컴포넌트의 CSS 스타일 import
import { Tag } from './tag' // 태그 컴포넌트 import

// 타입 정의 re-export - 외부에서 TagProps 타입 사용 가능
export type { TagProps } from './tag'

// 기본 export - 일반적인 import 패턴 지원 (import Tag from './tag')
export default Tag
