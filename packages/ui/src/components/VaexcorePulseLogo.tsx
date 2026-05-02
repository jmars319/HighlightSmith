import type { ImgHTMLAttributes } from "react";

type VaexcorePulseLogoProps = ImgHTMLAttributes<HTMLImageElement> & {
  src?: string;
  title?: string;
};

export function VaexcorePulseLogo({
  alt = "vaexcore pulse logo",
  src = "/vaexcore-pulse-logo.png",
  title = "vaexcore pulse",
  ...props
}: VaexcorePulseLogoProps) {
  return <img alt={alt} src={src} title={title} {...props} />;
}
