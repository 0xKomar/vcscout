import { Handle, Position } from '@xyflow/react'

const HANDLE_STYLE = { opacity: 0, width: 1, height: 1, minWidth: 0, minHeight: 0, border: 0 } as const

export function GraphHandles() {
  return (
    <>
      <Handle id="l" type="source" position={Position.Left} style={HANDLE_STYLE} />
      <Handle id="r" type="source" position={Position.Right} style={HANDLE_STYLE} />
      <Handle id="t" type="source" position={Position.Top} style={HANDLE_STYLE} />
      <Handle id="b" type="source" position={Position.Bottom} style={HANDLE_STYLE} />
    </>
  )
}
