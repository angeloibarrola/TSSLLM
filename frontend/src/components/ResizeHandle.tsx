import { Separator } from "react-resizable-panels";

export function ResizeHandle({ id }: { id?: string }) {
  return (
    <Separator
      id={id}
      className="group relative w-1.5 bg-gray-800 transition-colors hover:bg-blue-500 active:bg-blue-400 data-[separator-active]:bg-blue-400"
    >
      <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-0.5 bg-gray-600 group-hover:bg-blue-300 group-active:bg-blue-200 transition-colors" />
    </Separator>
  );
}
