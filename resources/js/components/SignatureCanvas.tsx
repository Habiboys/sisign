import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PenTool, Trash2, Upload } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';

interface SignatureCanvasProps {
    onSignatureChange: (signatureData: string | null, passphrase?: string) => void;
    initialSignature?: string | null;
}

export default function SignatureCanvas({
    onSignatureChange,
    initialSignature,
}: SignatureCanvasProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [signatureMethod, setSignatureMethod] = useState<'draw' | 'upload'>(
        'draw',
    );
    const [currentSignature, setCurrentSignature] = useState<string | null>(null);
    const [passphrase, setPassphrase] = useState<string>('');

    const startDrawing = useCallback(
        (e: React.MouseEvent<HTMLCanvasElement>) => {
            if (signatureMethod !== 'draw') return;

            setIsDrawing(true);
            const canvas = canvasRef.current;
            if (!canvas) return;

            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            ctx.beginPath();
            ctx.moveTo(x, y);
        },
        [signatureMethod],
    );

    const draw = useCallback(
        (e: React.MouseEvent<HTMLCanvasElement>) => {
            if (!isDrawing || signatureMethod !== 'draw') return;

            const canvas = canvasRef.current;
            if (!canvas) return;

            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            ctx.lineTo(x, y);
            ctx.stroke();
        },
        [isDrawing, signatureMethod],
    );

    const stopDrawing = useCallback(() => {
        if (!isDrawing) return;

        setIsDrawing(false);
        const canvas = canvasRef.current;
        if (!canvas) return;

        // Create a new canvas to ensure transparency
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        if (!tempCtx) return;

        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;

        // Don't fill background - keep it transparent
        tempCtx.globalCompositeOperation = 'source-over';
        tempCtx.drawImage(canvas, 0, 0);

        // Get signature as PNG with transparency
        const signatureData = tempCanvas.toDataURL('image/png');
        setCurrentSignature(signatureData);
    }, [isDrawing]);

    const clearCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Clear with transparent background
        ctx.globalCompositeOperation = 'source-over';
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Reset drawing properties
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.globalAlpha = 1.0;
        
        setCurrentSignature(null);
    }, []);

    const handleFileUpload = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                const result = event.target?.result as string;
                setCurrentSignature(result);
            };
            reader.readAsDataURL(file);
        },
        [],
    );

    const removeWhiteBackground = useCallback((imageData: string): Promise<string> => {
        return new Promise<string>((resolve) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    resolve(imageData);
                    return;
                }

                canvas.width = img.width;
                canvas.height = img.height;

                // Draw image
                ctx.drawImage(img, 0, 0);

                // Get image data
                const imageDataObj = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imageDataObj.data;

                // Make white pixels transparent
                for (let i = 0; i < data.length; i += 4) {
                    const r = data[i];
                    const g = data[i + 1];
                    const b = data[i + 2];
                    
                    // If pixel is white or very light, make it transparent
                    if (r > 240 && g > 240 && b > 240) {
                        data[i + 3] = 0; // Set alpha to 0 (transparent)
                    }
                }

                // Put modified image data back
                ctx.putImageData(imageDataObj, 0, 0);
                
                resolve(canvas.toDataURL('image/png'));
            };
            img.src = imageData;
        });
    }, []);

    const handleDone = useCallback(async () => {
        if (currentSignature) {
            const transparentSignature = await removeWhiteBackground(currentSignature);
            onSignatureChange(transparentSignature, passphrase || undefined);
        } else {
            onSignatureChange(currentSignature, passphrase || undefined);
        }
    }, [currentSignature, onSignatureChange, removeWhiteBackground, passphrase]);

    const handleCancel = useCallback(() => {
        onSignatureChange(null);
    }, [onSignatureChange]);

    const initializeCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Set canvas size
        canvas.width = 400;
        canvas.height = 200;

        // Ensure completely transparent background
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Set alpha compositing to maintain transparency
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1.0;

        // Set drawing style with good contrast
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        // Ensure no background fill
        ctx.fillStyle = 'transparent';

        // Load initial signature if provided
        if (initialSignature && signatureMethod === 'draw') {
            const img = new Image();
            img.onload = () => {
                ctx.drawImage(img, 0, 0);
            };
            img.src = initialSignature;
        }
    }, [initialSignature, signatureMethod]);

    // Initialize canvas on mount
    useState(() => {
        initializeCanvas();
    });

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center">
                    <PenTool className="mr-2 h-5 w-5" />
                    Tanda Tangan Digital
                </CardTitle>
                <CardDescription>
                    Pilih metode tanda tangan digital
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Method Selection */}
                <div className="flex space-x-2">
                    <Button
                        variant={
                            signatureMethod === 'draw' ? 'default' : 'outline'
                        }
                        onClick={(e) => {
                            e.stopPropagation();
                            setSignatureMethod('draw');
                        }}
                        className="flex-1"
                    >
                        <PenTool className="mr-2 h-4 w-4" />
                        Gambar Tanda Tangan
                    </Button>
                    <Button
                        variant={
                            signatureMethod === 'upload' ? 'default' : 'outline'
                        }
                        onClick={(e) => {
                            e.stopPropagation();
                            setSignatureMethod('upload');
                        }}
                        className="flex-1"
                    >
                        <Upload className="mr-2 h-4 w-4" />
                        Upload File
                    </Button>
                </div>

                {/* Drawing Canvas */}
                {signatureMethod === 'draw' && (
                    <div className="space-y-4">
                        <div className="rounded-lg border-2 border-dashed border-gray-300 p-4 bg-white">
                            <canvas
                                ref={canvasRef}
                                className="mx-auto block w-full max-w-md cursor-crosshair rounded border border-gray-200"
                                onMouseDown={(e) => {
                                    e.stopPropagation();
                                    startDrawing(e);
                                }}
                                onMouseMove={(e) => {
                                    e.stopPropagation();
                                    draw(e);
                                }}
                                onMouseUp={(e) => {
                                    e.stopPropagation();
                                    stopDrawing();
                                }}
                                onMouseLeave={(e) => {
                                    e.stopPropagation();
                                    stopDrawing();
                                }}
                                style={{ 
                                    touchAction: 'none',
                                    backgroundColor: 'transparent',
                                    backgroundImage: `url("data:image/svg+xml,%3csvg width='8' height='8' xmlns='http://www.w3.org/2000/svg'%3e%3cg fill='%23cccccc' fill-opacity='0.4' fill-rule='evenodd'%3e%3cpath d='m0 0h4v4h-4z'/%3e%3c/g%3e%3c/svg%3e")`,
                                    backgroundSize: '8px 8px'
                                }}
                            />
                        </div>
                        <div className="flex justify-center space-x-2">
                            <Button
                                variant="outline"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    clearCanvas();
                                }}
                                className="text-red-600 hover:text-red-700"
                            >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Hapus
                            </Button>
                        </div>
                    </div>
                )}

                {/* File Upload */}
                {signatureMethod === 'upload' && (
                    <div className="space-y-4">
                        <div>
                            <Label htmlFor="signature-file">
                                Upload File Tanda Tangan
                            </Label>
                            <Input
                                ref={fileInputRef}
                                id="signature-file"
                                type="file"
                                accept="image/*"
                                onChange={(e) => {
                                    e.stopPropagation();
                                    handleFileUpload(e);
                                }}
                                onClick={(e) => e.stopPropagation()}
                                className="mt-1"
                            />
                            <p className="mt-1 text-sm text-gray-500">
                                Format yang didukung: PNG, JPG, JPEG (MAX. 2MB)
                            </p>
                        </div>
                    </div>
                )}

                {/* Current Signature Preview */}
                {currentSignature && (
                    <div className="space-y-2">
                        <Label>Preview Tanda Tangan:</Label>
                        <div className="rounded border border-gray-200 p-2">
                            <img
                                src={currentSignature}
                                alt="Current Signature Preview"
                                className="mx-auto h-auto max-h-32 max-w-full"
                            />
                        </div>
                    </div>
                )}

                {/* Initial Preview */}
                {initialSignature && !currentSignature && (
                    <div className="space-y-2">
                        <Label>Preview Tanda Tangan:</Label>
                        <div className="rounded border border-gray-200 p-2">
                            <img
                                src={initialSignature}
                                alt="Signature Preview"
                                className="mx-auto h-auto max-h-32 max-w-full"
                            />
                        </div>
                    </div>
                )}

                {/* Digital Signature Passphrase */}
                <div className="space-y-2">
                    <Label htmlFor="passphrase">
                        Passphrase untuk Digital Signature (Opsional)
                    </Label>
                    <Input
                        id="passphrase"
                        type="password"
                        value={passphrase}
                        onChange={(e) => setPassphrase(e.target.value)}
                        placeholder="Masukkan passphrase untuk keamanan tambahan"
                        className="w-full"
                    />
                    <p className="text-xs text-gray-500">
                        Passphrase akan digunakan untuk melindungi private key digital signature Anda. Kosongkan jika tidak ingin menggunakan passphrase.
                    </p>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end space-x-2 pt-4 border-t">
                    <Button
                        variant="outline"
                        onClick={(e) => {
                            e.stopPropagation();
                            handleCancel();
                        }}
                    >
                        Batal
                    </Button>
                    <Button
                        onClick={(e) => {
                            e.stopPropagation();
                            handleDone();
                        }}
                        disabled={!currentSignature && !initialSignature}
                    >
                        Selesai
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}





