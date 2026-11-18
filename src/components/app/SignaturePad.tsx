import { forwardRef } from "react";
import SignatureCanvasImpl from "react-signature-canvas";
import type { ComponentType, Ref } from "react";
type SignatureCanvas = SignatureCanvasImpl;
const SignatureCanvas = SignatureCanvasImpl as unknown as ComponentType<{ ref?: Ref<SignatureCanvasImpl>; penColor?: string; canvasProps?: Record<string, unknown> }>;

const SignaturePad = forwardRef<SignatureCanvas>(function SignaturePad(_, ref) {
  return <div className="rounded border bg-white"><SignatureCanvas ref={ref} penColor="black" canvasProps={{ className: "h-48 w-full" }} /></div>;
});
export default SignaturePad;
