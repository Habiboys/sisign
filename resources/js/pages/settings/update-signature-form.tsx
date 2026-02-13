import HeadingSmall from '@/components/heading-small';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { type SharedData } from '@/types';
import { Transition } from '@headlessui/react';
import { useForm, usePage } from '@inertiajs/react';
import { useRef, useState, type FormEventHandler } from 'react';

export default function UpdateSignatureForm({
    className = '',
}: {
    className?: string;
}) {
    const { auth } = usePage<SharedData>().props;
    const signatureImageInput = useRef<HTMLInputElement>(null);

    const {
        data,
        setData,
        post,
        errors,
        processing,
        recentlySuccessful,
        reset,
    } = useForm({
        pin: '',
        signature_image: null as File | null,
    });

    const [previewImage, setPreviewImage] = useState<string | null>(null);

    const submit: FormEventHandler = (e) => {
        e.preventDefault();

        post('/settings/profile/signature', {
            preserveScroll: true,
            onSuccess: () => {
                reset();
                setPreviewImage(null);
                if (signatureImageInput.current) {
                    signatureImageInput.current.value = '';
                }
            },
        });
    };

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files ? e.target.files[0] : null;
        setData('signature_image', file);

        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                setPreviewImage(e.target?.result as string);
            };
            reader.readAsDataURL(file);
        } else {
            setPreviewImage(null);
        }
    };

    return (
        <section className={className}>
            <HeadingSmall
                title="Signature Settings"
                description="Manage your PIN and signature image for signing documents."
            />

            <form onSubmit={submit} className="mt-6 space-y-6">
                <div className="grid gap-2">
                    <Label htmlFor="pin">Signature PIN (6 Digits)</Label>

                    <Input
                        id="pin"
                        type="password"
                        className="mt-1 block w-full"
                        value={data.pin}
                        onChange={(e) => setData('pin', e.target.value)}
                        placeholder="Enter new 6-digit PIN"
                        autoComplete="new-password"
                        maxLength={6}
                        pattern="\d{6}"
                    />

                    <p className="text-sm text-gray-500">
                        Leave blank if you don't want to change your PIN.
                    </p>

                    <InputError className="mt-2" message={errors.pin} />
                </div>

                <div className="grid gap-2">
                    <Label htmlFor="signature_image">Signature Image</Label>

                    {/* Show Preview of Selected Image OR Current Image */}
                    {(previewImage || auth.user.signature_image) && (
                        <div className="mb-4">
                            <p className="mb-2 text-sm text-gray-500">
                                {previewImage ? 'New Signature Preview:' : 'Current Signature:'}
                            </p>
                            <img
                                src={previewImage || `/storage/${auth.user.signature_image}`}
                                alt="Signature Preview"
                                className="h-20 w-auto border border-gray-200 rounded p-2 bg-white object-contain"
                            />
                        </div>
                    )}

                    <Input
                        id="signature_image"
                        type="file"
                        className="mt-1 block w-full cursor-pointer"
                        onChange={handleImageChange}
                        ref={signatureImageInput}
                        accept="image/png, image/jpeg"
                    />

                    <p className="text-sm text-gray-500">
                        Upload a transparent PNG image of your signature. Max 2MB.
                    </p>

                    <InputError
                        className="mt-2"
                        message={errors.signature_image}
                    />
                </div>

                <div className="flex items-center gap-4">
                    <Button disabled={processing}>Save</Button>

                    <Transition
                        show={recentlySuccessful}
                        enter="transition ease-in-out"
                        enterFrom="opacity-0"
                        leave="transition ease-in-out"
                        leaveTo="opacity-0"
                    >
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            Saved.
                        </p>
                    </Transition>
                </div>
            </form>
        </section>
    );
}
