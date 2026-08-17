import HeadingSmall from '@/components/heading-small';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    InputOTP,
    InputOTPGroup,
    InputOTPSlot,
} from '@/components/ui/input-otp';
import { Label } from '@/components/ui/label';
import { type SharedData } from '@/types';
import { Transition } from '@headlessui/react';
import { useForm, usePage } from '@inertiajs/react';
import { REGEXP_ONLY_DIGITS } from 'input-otp';
import { useRef, useState, type FormEventHandler } from 'react';

const PIN_LENGTH = 6;

function PinInput({
    id,
    value,
    onChange,
    disabled,
}: {
    id: string;
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
}) {
    return (
        <InputOTP
            id={id}
            name={id}
            maxLength={PIN_LENGTH}
            value={value}
            onChange={onChange}
            disabled={disabled}
            pattern={REGEXP_ONLY_DIGITS}
            inputMode="numeric"
            autoComplete="one-time-code"
        >
            <InputOTPGroup>
                {Array.from({ length: PIN_LENGTH }, (_, index) => (
                    <InputOTPSlot key={index} index={index} />
                ))}
            </InputOTPGroup>
        </InputOTP>
    );
}

export default function UpdateSignatureForm({
    className = '',
}: {
    className?: string;
}) {
    const { auth } = usePage<SharedData>().props;
    const signatureImageInput = useRef<HTMLInputElement>(null);
    const hasExistingPin = Boolean(auth.user.has_pin);

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
        pin_confirmation: '',
        current_pin: '',
        signature_image: null as File | null,
    });

    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [rateLimitError, setRateLimitError] = useState<string | null>(null);

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        setRateLimitError(null);

        post('/settings/profile/signature', {
            preserveScroll: true,
            onSuccess: () => {
                reset();
                setPreviewImage(null);
                if (signatureImageInput.current) {
                    signatureImageInput.current.value = '';
                }
            },
            onError: (formErrors) => {
                // Throttled requests (429) don't carry Laravel validation errors,
                // so an empty error bag here means the request was rate-limited.
                if (Object.keys(formErrors).length === 0) {
                    setRateLimitError(
                        'Terlalu banyak percobaan, coba lagi dalam beberapa menit.',
                    );
                }
            },
            onFinish: () => {
                // Never keep PIN digits in state after a submit attempt, success or not.
                setData((prev) => ({
                    ...prev,
                    pin: '',
                    pin_confirmation: '',
                    current_pin: '',
                }));
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
                {rateLimitError && (
                    <p className="rounded-md bg-red-50 p-3 text-sm text-red-600">
                        {rateLimitError}
                    </p>
                )}

                {hasExistingPin && (
                    <div className="grid gap-2">
                        <Label htmlFor="current_pin">Current PIN</Label>

                        <PinInput
                            id="current_pin"
                            value={data.current_pin}
                            onChange={(value) => setData('current_pin', value)}
                            disabled={processing}
                        />

                        <p className="text-sm text-gray-500">
                            Required to confirm your identity before changing
                            your PIN.
                        </p>

                        <InputError
                            className="mt-2"
                            message={errors.current_pin}
                        />
                    </div>
                )}

                <div className="grid gap-2">
                    <Label htmlFor="pin">
                        {hasExistingPin ? 'New Signature PIN' : 'Signature PIN'}{' '}
                        (6 Digits)
                    </Label>

                    <PinInput
                        id="pin"
                        value={data.pin}
                        onChange={(value) => setData('pin', value)}
                        disabled={processing}
                    />

                    <p className="text-sm text-gray-500">
                        Leave blank if you don't want to change your PIN.
                    </p>

                    <InputError className="mt-2" message={errors.pin} />
                </div>

                {data.pin && (
                    <div className="grid gap-2">
                        <Label htmlFor="pin_confirmation">
                            Confirm New PIN
                        </Label>

                        <PinInput
                            id="pin_confirmation"
                            value={data.pin_confirmation}
                            onChange={(value) =>
                                setData('pin_confirmation', value)
                            }
                            disabled={processing}
                        />

                        <p className="text-sm text-gray-500">
                            Re-enter the new PIN to make sure it matches.
                        </p>

                        <InputError
                            className="mt-2"
                            message={errors.pin_confirmation}
                        />
                    </div>
                )}

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
