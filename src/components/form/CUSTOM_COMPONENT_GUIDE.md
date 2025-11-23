# FormItem 호환 커스텀 컴포넌트 가이드

이 문서는 `Form.Item`과 함께 사용할 수 있는 커스텀 컴포넌트를 만드는 방법을 설명합니다.

## 목차

1. [기본 원리](#1-기본-원리)
2. [필수 구현 사항](#2-필수-구현-사항)
3. [구현 예시](#3-구현-예시)
4. [고급 옵션](#4-고급-옵션)
5. [트러블슈팅](#5-트러블슈팅)

---

## 1. 기본 원리

### FormItem이 자식에게 주입하는 Props

`Form.Item`은 내부적으로 자식 컴포넌트에 다음 props를 자동으로 주입합니다:

```tsx
// form-item.tsx 내부 동작
const childProps = { ...children.props, ...control }

// control 객체 구조
control = {
  value: any,           // 현재 필드 값
  onChange: Function,   // 값 변경 핸들러
  // + validateTrigger에 따른 추가 핸들러
}
```

### 데이터 흐름

```
사용자 입력
    │
    ▼
커스텀 컴포넌트의 onChange 호출
    │
    ▼
FormItem이 주입한 onChange 실행
    │
    ▼
rc-field-form Store 업데이트
    │
    ▼
폼 상태 변경 (form.getFieldValue로 조회 가능)
```

---

## 2. 필수 구현 사항

### 최소 요구사항

FormItem과 호환되려면 **반드시** 다음 props를 받아야 합니다:

| Prop       | 타입                   | 설명                        |
| ---------- | ---------------------- | --------------------------- |
| `value`    | `any`                  | FormItem이 주입하는 현재 값 |
| `onChange` | `(value: any) => void` | 값 변경 시 호출할 핸들러    |

### 권장 사항

| 항목                 | 이유                                         |
| -------------------- | -------------------------------------------- |
| `forwardRef` 사용    | FormItem의 `onClick` + `widgetRef` 연동 지원 |
| `id` prop 수용       | 접근성 (label과 input 연결)                  |
| `disabled` prop 수용 | Form 레벨 disabled 상태 전파                 |

---

## 3. 구현 예시

### 3.1 기본 Select 컴포넌트

```tsx
import React, { forwardRef, useState } from 'react'
import { Popup, List } from 'antd-mobile'

interface Option {
  label: string
  value: string
}

interface SelectProps {
  // FormItem 호환 필수 props
  value?: string
  onChange?: (value: string) => void

  // 컴포넌트 고유 props
  options?: Option[]
  placeholder?: string
  disabled?: boolean
  id?: string
}

export const Select = forwardRef<HTMLDivElement, SelectProps>((props, ref) => {
  const {
    value,
    onChange,  // FormItem이 주입
    options = [],
    placeholder = '선택하세요',
    disabled,
    id,
  } = props

  const [visible, setVisible] = useState(false)

  // 현재 선택된 옵션의 라벨 찾기
  const selectedLabel = options.find(opt => opt.value === value)?.label

  const handleSelect = (selectedValue: string) => {
    onChange?.(selectedValue)  // 핵심: FormItem의 onChange 호출
    setVisible(false)
  }

  return (
    <div ref={ref} id={id}>
      <div
        onClick={() => !disabled && setVisible(true)}
        style={{
          color: selectedLabel ? '#333' : '#999',
          opacity: disabled ? 0.5 : 1,
        }}
      >
        {selectedLabel || placeholder}
      </div>

      <Popup visible={visible} onMaskClick={() => setVisible(false)}>
        <List>
          {options.map(option => (
            <List.Item
              key={option.value}
              onClick={() => handleSelect(option.value)}
            >
              {option.label}
            </List.Item>
          ))}
        </List>
      </Popup>
    </div>
  )
})

Select.displayName = 'Select'
```

### 3.2 사용 예시

```tsx
import Form from 'antd-mobile/es/components/form'
import { Select } from './Select'

const cityOptions = [
  { label: '서울', value: 'seoul' },
  { label: '부산', value: 'busan' },
  { label: '대구', value: 'daegu' },
]

function MyForm() {
  const [form] = Form.useForm()

  return (
    <Form form={form} onFinish={(values) => console.log(values)}>
      <Form.Item
        name="city"
        label="도시"
        rules={[{ required: true, message: '도시를 선택하세요' }]}
      >
        <Select options={cityOptions} placeholder="도시 선택" />
      </Form.Item>
    </Form>
  )
}
```

### 3.3 DatePicker 스타일 컴포넌트

Picker 류 컴포넌트에서 `onClick` + `widgetRef` 패턴 활용:

```tsx
import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react'

interface DateSelectProps {
  value?: Date
  onChange?: (value: Date) => void
}

// ref를 통해 open 메서드 노출
interface DateSelectRef {
  open: () => void
}

export const DateSelect = forwardRef<DateSelectRef, DateSelectProps>((props, ref) => {
  const { value, onChange } = props
  const [visible, setVisible] = useState(false)

  // 부모에서 ref.current.open() 호출 가능하게 함
  useImperativeHandle(ref, () => ({
    open: () => setVisible(true),
  }))

  return (
    <div>
      <span>{value?.toLocaleDateString() || '날짜 선택'}</span>
      {/* DatePicker Popup */}
    </div>
  )
})
```

```tsx
// FormItem의 onClick으로 Picker 열기
<Form.Item
  name="date"
  label="날짜"
  onClick={(e, widgetRef) => {
    widgetRef.current?.open()  // DateSelect의 open 메서드 호출
  }}
>
  <DateSelect />
</Form.Item>
```

---

## 4. 고급 옵션

### 4.1 trigger 커스터마이징

기본 trigger는 `onChange`이지만, 다른 이벤트로 변경 가능합니다:

```tsx
// onConfirm으로 값 수집
<Form.Item name="date" trigger="onConfirm">
  <DatePicker />  // onConfirm prop 필요
</Form.Item>

// onSelect로 값 수집
<Form.Item name="item" trigger="onSelect">
  <CustomList />  // onSelect prop 필요
</Form.Item>
```

**컴포넌트에서 해당 핸들러 구현 필요:**

```tsx
interface CustomListProps {
  value?: string
  onSelect?: (value: string) => void  // trigger="onSelect" 사용 시
}
```

### 4.2 valuePropName 커스터마이징

`checked` 등 다른 prop으로 값을 받는 경우:

```tsx
// 체크박스 스타일 컴포넌트
interface ToggleProps {
  checked?: boolean           // value 대신 checked 사용
  onChange?: (checked: boolean) => void
}

// FormItem에서 valuePropName 지정
<Form.Item name="agree" valuePropName="checked">
  <Toggle />
</Form.Item>
```

### 4.3 validateTrigger 분리

값 수집과 유효성 검사 타이밍을 분리:

```tsx
<Form.Item
  name="email"
  trigger="onChange"           // 값은 onChange로 수집
  validateTrigger="onBlur"     // 검사는 onBlur에서 실행
>
  <Input />
</Form.Item>
```

**컴포넌트에서 두 핸들러 모두 호출 가능해야 함:**

```tsx
// FormItem은 내부적으로 두 핸들러를 병합
childProps.onChange = (...args) => {
  control.onChange?.(...args)
  children.props.onChange?.(...args)
}
childProps.onBlur = (...args) => {
  control.onBlur?.(...args)
  children.props.onBlur?.(...args)
}
```

### 4.4 getValueFromEvent 사용

이벤트 객체에서 값을 추출해야 하는 경우:

```tsx
// 네이티브 input 이벤트 처리
<Form.Item
  name="file"
  getValueFromEvent={(e) => e.target.files[0]}
>
  <input type="file" />
</Form.Item>

// 커스텀 이벤트 구조 처리
<Form.Item
  name="color"
  getValueFromEvent={(color, hex) => hex}
>
  <ColorPicker />  // onChange(color, hex) 형태로 호출
</Form.Item>
```

---

## 5. 트러블슈팅

### 5.1 값이 저장되지 않음

**원인**: `onChange` 호출 안함

```tsx
// ❌ 잘못된 예
const Select = ({ value }) => {
  const [selected, setSelected] = useState(value)

  const handleSelect = (v) => {
    setSelected(v)  // 내부 상태만 변경, 폼에 반영 안됨
  }
}

// ✅ 올바른 예
const Select = ({ value, onChange }) => {
  const handleSelect = (v) => {
    onChange?.(v)  // FormItem의 onChange 호출
  }
}
```

### 5.2 초기값이 표시되지 않음

**원인**: `value` prop 무시

```tsx
// ❌ 잘못된 예
const Select = () => {
  const [selected, setSelected] = useState('')  // 빈 값으로 초기화
}

// ✅ 올바른 예
const Select = ({ value }) => {
  // value를 직접 사용하거나
  const displayValue = value

  // 또는 내부 상태와 동기화
  const [selected, setSelected] = useState(value)
  useEffect(() => setSelected(value), [value])
}
```

### 5.3 ref 경고 발생

**원인**: 함수 컴포넌트에 ref 전달

```
Warning: Function components cannot be given refs.
```

```tsx
// ❌ 잘못된 예
const Select = (props) => { ... }

// ✅ 올바른 예
const Select = forwardRef((props, ref) => {
  return <div ref={ref}>...</div>
})
```

### 5.4 disabled 상태가 적용되지 않음

**원인**: Form 레벨 disabled 미처리

```tsx
// FormItem은 FormContext의 disabled를 자식에게 전달하지 않음
// 직접 처리 필요

const Select = ({ disabled, ...props }) => {
  // disabled prop 활용
}

// 또는 Form.Item에서 개별 지정
<Form.Item name="city" disabled>
  <Select />
</Form.Item>
```

---

## 체크리스트

커스텀 컴포넌트 구현 시 확인 사항:

- [ ] `value` prop을 받아서 표시하는가?
- [ ] `onChange` prop을 호출하여 값을 전달하는가?
- [ ] `forwardRef`를 사용하는가? (권장)
- [ ] `id` prop을 루트 요소에 전달하는가? (접근성)
- [ ] `disabled` prop을 처리하는가?
- [ ] TypeScript 타입이 올바르게 정의되었는가?

```tsx
// 최종 템플릿
import { forwardRef } from 'react'

interface MyComponentProps {
  value?: ValueType
  onChange?: (value: ValueType) => void
  disabled?: boolean
  id?: string
  // ... 기타 props
}

export const MyComponent = forwardRef<HTMLDivElement, MyComponentProps>(
  (props, ref) => {
    const { value, onChange, disabled, id, ...rest } = props

    const handleChange = (newValue: ValueType) => {
      if (!disabled) {
        onChange?.(newValue)
      }
    }

    return (
      <div ref={ref} id={id}>
        {/* 구현 */}
      </div>
    )
  }
)

MyComponent.displayName = 'MyComponent'
```
