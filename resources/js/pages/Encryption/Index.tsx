import React, { useState } from 'react';
import { Head, useForm } from '@inertiajs/react';
import { AppShell } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface KeyInfo {
    created_at: string;
    key_size: number;
    key_type: string;
    algorithm: string;
    public_key_fingerprint: string;
}

interface EncryptionIndexProps {
    hasKeys: boolean;
    keyInfo?: KeyInfo;
    publicKey?: string;
}

export default function EncryptionIndex({ hasKeys, keyInfo, publicKey }: EncryptionIndexProps) {
    const [showGenerateForm, setShowGenerateForm] = useState(false);
    const [showTestForm, setShowTestForm] = useState(false);
    const [testResults, setTestResults] = useState<any>(null);

    const generateForm = useForm({
        passphrase: '',
        confirm_passphrase: '',
    });

    const testForm = useForm({
        test_data: 'Hello, this is a test message for encryption!',
        passphrase: '',
    });

    const deleteForm = useForm({
        confirmation: '',
    });

    const handleGenerateKeys = (e: React.FormEvent) => {
        e.preventDefault();
        
        generateForm.post('/encryption/generate-keys', {
            onSuccess: (page: any) => {
                if (page.props?.success) {
                    alert(page.props.success);
                } else {
                    alert('Encryption keys generated successfully!');
                }
                setShowGenerateForm(false);
                window.location.reload();
            },
            onError: (errors: any) => {
                console.error('Key generation error:', errors);
                let errorMessage = 'Failed to generate keys';
                
                if (errors.error) {
                    errorMessage = errors.error;
                } else if (errors.message) {
                    errorMessage = errors.message;
                } else if (typeof errors === 'string') {
                    errorMessage = errors;
                }
                
                alert(errorMessage);
            }
        });
    };

    const handleTestEncryption = (e: React.FormEvent) => {
        e.preventDefault();
        
        testForm.post('/encryption/test', {
            onSuccess: (response: any) => {
                setTestResults(response.props?.test_results);
            },
            onError: (errors: any) => {
                alert(errors.message || 'Test failed');
            }
        });
    };

    const handleDeleteKeys = (e: React.FormEvent) => {
        e.preventDefault();
        
        if (deleteForm.data.confirmation !== 'DELETE') {
            alert('Please type DELETE to confirm');
            return;
        }

        deleteForm.delete('/encryption/delete-keys', {
            onSuccess: () => {
                alert('Encryption keys deleted successfully');
                window.location.reload();
            },
            onError: (errors: any) => {
                alert(errors.message || 'Failed to delete keys');
            }
        });
    };

    const downloadPublicKey = () => {
        window.open('/encryption/download-public-key', '_blank');
    };

    return (
        <AppShell>
            <Head title="Encryption Keys Management" />
            
            <div className="max-w-4xl mx-auto p-6">
                <div className="mb-6">
                    <h1 className="text-3xl font-bold text-gray-900">Encryption Keys Management</h1>
                    <p className="text-gray-600 mt-2">
                        Manage your cryptographic keys for digital signatures
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Current Keys Status */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Current Keys Status</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {hasKeys ? (
                                <div className="space-y-4">
                                    <div className="flex items-center">
                                        <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
                                        <span className="text-green-600 font-medium">Keys Generated</span>
                                    </div>
                                    
                                    {keyInfo && (
                                        <div className="space-y-2 text-sm">
                                            <div className="flex justify-between">
                                                <span className="text-gray-600">Key Type:</span>
                                                <span className="font-medium">{keyInfo.key_type}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-600">Key Size:</span>
                                                <span className="font-medium">{keyInfo.key_size} bits</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-600">Algorithm:</span>
                                                <span className="font-medium">{keyInfo.algorithm}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-600">Created:</span>
                                                <span className="font-medium">
                                                    {new Date(keyInfo.created_at).toLocaleDateString()}
                                                </span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-600">Fingerprint:</span>
                                                <span className="font-mono text-xs">
                                                    {keyInfo.public_key_fingerprint}
                                                </span>
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex space-x-2 pt-4">
                                        <Button
                                            onClick={downloadPublicKey}
                                            variant="outline"
                                            size="sm"
                                        >
                                            Download Public Key
                                        </Button>
                                        <Button
                                            onClick={() => setShowTestForm(true)}
                                            variant="outline"
                                            size="sm"
                                        >
                                            Test Encryption
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="flex items-center">
                                        <div className="w-3 h-3 bg-red-500 rounded-full mr-3"></div>
                                        <span className="text-red-600 font-medium">No Keys Generated</span>
                                    </div>
                                    <p className="text-sm text-gray-600">
                                        You need to generate encryption keys to use digital signatures.
                                    </p>
                                    <Button
                                        onClick={() => setShowGenerateForm(true)}
                                        className="w-full"
                                    >
                                        Generate New Keys
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Key Management Actions */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Key Management</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                <h4 className="font-medium text-blue-800 mb-2">About Digital Signatures</h4>
                                <ul className="text-sm text-blue-700 space-y-1">
                                    <li>• Uses RSA 2048-bit encryption</li>
                                    <li>• SHA-256 hashing algorithm</li>
                                    <li>• Cryptographically secure</li>
                                    <li>• Tamper-evident and non-repudiable</li>
                                    <li>• Legally binding in many jurisdictions</li>
                                </ul>
                            </div>

                            {hasKeys && (
                                <div className="space-y-3">
                                    <Button
                                        onClick={() => setShowGenerateForm(true)}
                                        variant="outline"
                                        className="w-full"
                                    >
                                        Regenerate Keys
                                    </Button>
                                    
                                    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                                        <h4 className="font-medium text-yellow-800 mb-2">⚠️ Danger Zone</h4>
                                        <p className="text-sm text-yellow-700 mb-3">
                                            Deleting keys will invalidate all existing digital signatures.
                                        </p>
                                        <Button
                                            onClick={() => deleteForm.setData('confirmation', 'DELETE')}
                                            variant="destructive"
                                            size="sm"
                                            className="w-full"
                                        >
                                            Delete Keys
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Generate Keys Form */}
                {showGenerateForm && (
                    <Card className="mt-6">
                        <CardHeader>
                            <CardTitle>Generate New Encryption Keys</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleGenerateKeys} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium mb-2">
                                        Passphrase (Optional)
                                    </label>
                                    <input
                                        type="password"
                                        value={generateForm.data.passphrase}
                                        onChange={(e) => generateForm.setData('passphrase', e.target.value)}
                                        className="w-full px-3 py-2 border rounded-md"
                                        placeholder="Enter a passphrase to encrypt your private key"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">
                                        Leave empty for unencrypted private key (not recommended)
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-2">
                                        Confirm Passphrase
                                    </label>
                                    <input
                                        type="password"
                                        value={generateForm.data.confirm_passphrase}
                                        onChange={(e) => generateForm.setData('confirm_passphrase', e.target.value)}
                                        className="w-full px-3 py-2 border rounded-md"
                                        placeholder="Confirm your passphrase"
                                    />
                                </div>

                                <div className="flex justify-end space-x-3">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => setShowGenerateForm(false)}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        type="submit"
                                        disabled={generateForm.processing}
                                    >
                                        {generateForm.processing ? 'Generating...' : 'Generate Keys'}
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                )}

                {/* Test Encryption Form */}
                {showTestForm && (
                    <Card className="mt-6">
                        <CardHeader>
                            <CardTitle>Test Encryption & Signing</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleTestEncryption} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium mb-2">
                                        Test Message
                                    </label>
                                    <textarea
                                        value={testForm.data.test_data}
                                        onChange={(e) => testForm.setData('test_data', e.target.value)}
                                        className="w-full px-3 py-2 border rounded-md"
                                        rows={3}
                                        placeholder="Enter a message to test encryption"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-2">
                                        Passphrase (if set)
                                    </label>
                                    <input
                                        type="password"
                                        value={testForm.data.passphrase}
                                        onChange={(e) => testForm.setData('passphrase', e.target.value)}
                                        className="w-full px-3 py-2 border rounded-md"
                                        placeholder="Enter your private key passphrase"
                                    />
                                </div>

                                <div className="flex justify-end space-x-3">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => setShowTestForm(false)}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        type="submit"
                                        disabled={testForm.processing}
                                    >
                                        {testForm.processing ? 'Testing...' : 'Run Test'}
                                    </Button>
                                </div>
                            </form>

                            {testResults && (
                                <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                                    <h4 className="font-medium mb-3">Test Results</h4>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between">
                                            <span>Encryption Test:</span>
                                            <span className={testResults.encryption_success ? 'text-green-600' : 'text-red-600'}>
                                                {testResults.encryption_success ? '✓ Passed' : '✗ Failed'}
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Signature Test:</span>
                                            <span className={testResults.signature_valid ? 'text-green-600' : 'text-red-600'}>
                                                {testResults.signature_valid ? '✓ Valid' : '✗ Invalid'}
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Overall:</span>
                                            <span className={testResults.all_tests_passed ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                                                {testResults.all_tests_passed ? '✓ All Tests Passed' : '✗ Some Tests Failed'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}
            </div>
        </AppShell>
    );
}