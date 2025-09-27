import { FileSignature } from 'lucide-react';

interface LogoProps {
    className?: string;
    showText?: boolean;
}

export default function Logo({ className = '', showText = true }: LogoProps) {
    return (
        <div className={`flex items-center space-x-2 ${className}`}>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
                <FileSignature className="h-5 w-5 text-white" />
            </div>
            {showText && (
                <span className="text-xl font-bold text-gray-900">SISIGN</span>
            )}
        </div>
    );
}
