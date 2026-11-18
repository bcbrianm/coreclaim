import { forwardRef } from "react";
import SignatureCanvas from "react-signature-canvas";

const SignaturePad = forwardRef<SignatureCanvas>(function SignaturePad(_, ref) {
  return <div className="rounded border bg-white"><SignatureCanvas ref={ref} penColor="black" canvasProps={{ className: "h-48 w-full" }} /></div>;
});
export default SignaturePad;
