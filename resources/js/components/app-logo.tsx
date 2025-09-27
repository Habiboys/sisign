export default function AppLogo() {
    return (
        <>
            <div className="flex aspect-square size-8 items-center justify-center">
                <img
                    src="/images/sisign-logo-only.png"
                    alt="SISIGN Logo"
                    className="size-8 object-contain"
                />
            </div>
            <div className="ml-2 grid flex-1 text-left text-sm">
                <span className="mb-0.5 truncate leading-tight font-semibold">
                    SISIGN
                </span>
                <span className="truncate text-xs text-sidebar-foreground/70">
                    Sistem Informasi Tanda Tangan Digital
                </span>
            </div>
        </>
    );
}
