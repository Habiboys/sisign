import { SVGAttributes } from 'react';

export default function AppLogoIcon(props: SVGAttributes<SVGElement>) {
    return (
        <img
            src="/images/sisign-logo-only.png"
            alt="SISIGN Logo"
            className="size-9 object-contain"
            {...props}
        />
    );
}
