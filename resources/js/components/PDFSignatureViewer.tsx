import React, { useState, useRef, useCallback } from 'react';
import { Worker, Viewer } from '@react-pdf-viewer/core';
import { defaultLayoutPlugin } from '@react-pdf-viewer/default-layout';
import SignatureCanvas from './SignatureCanvas';

// Import styles
import '@react-pdf-viewer/core/lib/styles/index.css';
import '@react-pdf-viewer/default-layout/lib/styles/index.css';

interface SignaturePosition {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    page: number;
    type: 'physical' | 'digital';
    user?: {
        id: string;
        name: string;
    };
    signedAt?: string;
}

interface PDFSignatureViewerProps {
    pdfUrl: string;
    signatures: SignaturePosition[];
    onSignaturePositionChange: (signatureId: string, position: { x: number; y: number; width: number; height: number; page: number }) => void;
    onSignatureComplete: (signatureData: string, position: { x: number; y: number; page: number }, passphrase?: string) => void;
    canEdit?: boolean;
    currentPage: number;
    onPageChange: (page: number) => void;
}

const PDFSignatureViewer: React.FC<PDFSignatureViewerProps> = ({
    pdfUrl,
    signatures,
    onSignaturePositionChange,
    onSignatureComplete,
    canEdit = false,
    currentPage,
    onPageChange
}) => {
    const [showSignatureCanvas, setShowSignatureCanvas] = useState(false);
    const [signaturePosition, setSignaturePosition] = useState<{ x: number; y: number; page: number } | null>(null);
    const [tempSignature, setTempSignature] = useState<{
        id: string;
        x: number;
        y: number;
        width: number;
        height: number;
        page: number;
        signatureData: string;
        passphrase?: string;
    } | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [justFinishedDragging, setJustFinishedDragging] = useState(false);

    // Create a default layout plugin instance
    const defaultLayoutPluginInstance = defaultLayoutPlugin();

    const handlePageClick = useCallback((e: React.MouseEvent) => {
        if (!canEdit || justFinishedDragging) return;
        
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const x = Math.round(e.clientX - rect.left);
        const y = Math.round(e.clientY - rect.top);
        
        // Set position for signature canvas
        setSignaturePosition({ x, y, page: currentPage });
        setShowSignatureCanvas(true);
    }, [canEdit, currentPage, justFinishedDragging]);

    const handleSignatureComplete = (signatureData: string | null, passphrase?: string) => {
        if (signaturePosition && signatureData) {
            // Create temporary signature that user can position
            setTempSignature({
                id: 'temp-' + Date.now(),
                x: signaturePosition.x,
                y: signaturePosition.y,
                width: 150,
                height: 75,
                page: signaturePosition.page,
                signatureData: signatureData,
                passphrase: passphrase
            });
        }
        
        // Always close the signature canvas modal
        setShowSignatureCanvas(false);
        setSignaturePosition(null);
    };

    const handleTempSignatureSave = () => {
        if (tempSignature) {
            onSignatureComplete(tempSignature.signatureData, {
                x: tempSignature.x,
                y: tempSignature.y,
                page: tempSignature.page
            }, tempSignature.passphrase);
            setTempSignature(null);
        }
    };

    const handleTempSignatureCancel = () => {
        setTempSignature(null);
    };

    const handleTempSignatureDrag = (e: React.MouseEvent) => {
        if (!tempSignature || !canEdit) return;
        
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
        
        const startMouseX = e.clientX;
        const startMouseY = e.clientY;
        const startSigX = tempSignature.x;
        const startSigY = tempSignature.y;
        
        const handleMouseMove = (moveEvent: MouseEvent) => {
            const deltaX = moveEvent.clientX - startMouseX;
            const deltaY = moveEvent.clientY - startMouseY;
            
            const newX = Math.max(0, startSigX + deltaX);
            const newY = Math.max(0, startSigY + deltaY);
            
            setTempSignature(prev => prev ? {
                ...prev,
                x: Math.round(newX),
                y: Math.round(newY)
            } : null);
        };
        
        const handleMouseUp = () => {
            setIsDragging(false);
            setJustFinishedDragging(true);
            // Reset the flag after a short delay
            setTimeout(() => {
                setJustFinishedDragging(false);
            }, 100);
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
        
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    const handleSignatureCancel = () => {
        setShowSignatureCanvas(false);
        setSignaturePosition(null);
    };

    return (
        <div className="pdf-signature-viewer">
            {/* Instructions */}
            {canEdit && (
                <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <h4 className="font-semibold text-yellow-800 mb-2">Instructions:</h4>
                    <ul className="text-sm text-yellow-700 space-y-1">
                        <li>• Click on the PDF to place a signature</li>
                        <li>• Use the toolbar controls to navigate and zoom</li>
                        <li>• Your signature will create both physical and digital signatures</li>
                        <li>• Existing signatures can be dragged to reposition</li>
                    </ul>
                </div>
            )}

            {/* PDF Viewer */}
            <div 
                className="relative border border-gray-300 rounded-lg overflow-visible"
                style={{ height: '750px' }}
            >
                <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.4.120/build/pdf.worker.min.js">
                    <div 
                        className="h-full relative"
                        onClick={handlePageClick}
                        style={{ cursor: canEdit ? 'crosshair' : 'default' }}
                    >
                        <Viewer 
                            fileUrl={pdfUrl}
                            plugins={[defaultLayoutPluginInstance]}
                        />

                        {/* Signature overlays */}
                        {signatures.filter(s => s.page === currentPage).map((signature) => (
                            <div
                                key={signature.id}
                                className={`absolute border-2 rounded cursor-move ${
                                    signature.type === 'physical'
                                        ? 'border-blue-500 bg-blue-100 bg-opacity-30'
                                        : 'border-green-500 bg-green-100 bg-opacity-30'
                                }`}
                                style={{
                                    left: signature.x,
                                    top: signature.y,
                                    width: signature.width,
                                    height: signature.height,
                                    zIndex: 10,
                                }}
                                onMouseDown={(e) => {
                                    if (!canEdit) return;
                                    e.preventDefault();
                                    e.stopPropagation();
                                    
                                    let isDragging = false;
                                    const startMouseX = e.clientX;
                                    const startMouseY = e.clientY;
                                    const startSigX = signature.x;
                                    const startSigY = signature.y;
                                    
                                    const handleMouseMove = (moveEvent: MouseEvent) => {
                                        isDragging = true;
                                        const deltaX = moveEvent.clientX - startMouseX;
                                        const deltaY = moveEvent.clientY - startMouseY;
                                        
                                        const newX = Math.max(0, startSigX + deltaX);
                                        const newY = Math.max(0, startSigY + deltaY);
                                        
                                        onSignaturePositionChange(signature.id, {
                                            x: Math.round(newX),
                                            y: Math.round(newY),
                                            width: signature.width,
                                            height: signature.height,
                                            page: signature.page
                                        });
                                    };
                                    
                                    const handleMouseUp = (upEvent: MouseEvent) => {
                                        document.removeEventListener('mousemove', handleMouseMove);
                                        document.removeEventListener('mouseup', handleMouseUp);
                                        
                                        // Prevent click event if we were dragging
                                        if (isDragging) {
                                            setJustFinishedDragging(true);
                                            // Reset the flag after a short delay
                                            setTimeout(() => {
                                                setJustFinishedDragging(false);
                                            }, 100);
                                            upEvent.preventDefault();
                                            upEvent.stopPropagation();
                                        }
                                    };
                                    
                                    document.addEventListener('mousemove', handleMouseMove);
                                    document.addEventListener('mouseup', handleMouseUp);
                                }}
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                }}
                            >
                                <div className="p-1 text-xs">
                                    <div className="font-semibold">
                                        ✍️ {signature.user?.name || 'Unknown'}
                                    </div>
                                    {signature.signedAt && (
                                        <div className="text-gray-600">
                                            {new Date(signature.signedAt).toLocaleDateString()}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}

                        {/* Temporary Signature (before save) */}
                        {tempSignature && tempSignature.page === currentPage && (
                            <div
                                className="absolute border-2 border-blue-500 bg-blue-50 rounded cursor-move"
                                style={{
                                    left: tempSignature.x,
                                    top: tempSignature.y,
                                    width: tempSignature.width,
                                    height: tempSignature.height,
                                    zIndex: 20,
                                }}
                                onMouseDown={handleTempSignatureDrag}
                            >
                                <img 
                                    src={tempSignature.signatureData}
                                    alt="Signature preview"
                                    className="w-full h-full object-contain"
                                    draggable={false}
                                />
                                <div className="absolute -top-8 left-0 flex space-x-2">
                                    <button
                                        onClick={handleTempSignatureSave}
                                        className="px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600"
                                    >
                                        Save
                                    </button>
                                    <button
                                        onClick={handleTempSignatureCancel}
                                        className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        )}

                    </div>
                </Worker>
            </div>

            {/* Signature Canvas Modal - Outside PDF container */}
            {showSignatureCanvas && signaturePosition && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
                    onClick={(e) => {
                        e.stopPropagation();
                        handleSignatureCancel();
                    }}
                >
                    <div
                        className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto"
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                        onMouseMove={(e) => e.stopPropagation()}
                        onMouseUp={(e) => e.stopPropagation()}
                    >
                        <div className="p-6">
                            <h3 className="text-lg font-medium mb-4 text-gray-900">
                                Sign Document (Physical + Digital)
                            </h3>
                            <SignatureCanvas
                                onSignatureChange={handleSignatureComplete}
                            />
                            <div className="mt-4 text-sm text-gray-500">
                                This will create both physical and digital signatures at the position you clicked.
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PDFSignatureViewer;