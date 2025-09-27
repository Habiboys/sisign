import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { AlertTriangle, CheckCircle, Info, XCircle } from 'lucide-react';

interface AlertModalProps {
    open: boolean;
    onClose: () => void;
    title: string;
    description: string;
    type?: 'success' | 'error' | 'warning' | 'info';
    buttonText?: string;
}

export default function AlertModal({
    open,
    onClose,
    title,
    description,
    type = 'info',
    buttonText = 'OK',
}: AlertModalProps) {
    const getIcon = () => {
        switch (type) {
            case 'success':
                return <CheckCircle className="h-6 w-6 text-green-600" />;
            case 'error':
                return <XCircle className="h-6 w-6 text-red-600" />;
            case 'warning':
                return <AlertTriangle className="h-6 w-6 text-yellow-600" />;
            default:
                return <Info className="h-6 w-6 text-blue-600" />;
        }
    };

    const getButtonVariant = () => {
        switch (type) {
            case 'success':
                return 'bg-green-600 hover:bg-green-700';
            case 'error':
                return 'bg-red-600 hover:bg-red-700';
            case 'warning':
                return 'bg-yellow-600 hover:bg-yellow-700';
            default:
                return 'bg-blue-600 hover:bg-blue-700';
        }
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <div className="flex items-center space-x-3">
                        {getIcon()}
                        <DialogTitle>{title}</DialogTitle>
                    </div>
                    <DialogDescription className="pt-2">{description}</DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button className={getButtonVariant()} onClick={onClose}>
                        {buttonText}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
