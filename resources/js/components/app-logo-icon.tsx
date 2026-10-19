import { ImgHTMLAttributes } from 'react';

export default function AppLogoIcon(
    props: ImgHTMLAttributes<HTMLImageElement>,
) {
    return (
        <img
            src="/images/sisign-logo-only.png"
            alt="SISIGN Logo"
            className="size-9 object-contain"
            {...props}
        />
    );
}
