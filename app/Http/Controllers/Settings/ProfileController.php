<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Http\Requests\Settings\ProfileUpdateRequest;
use App\Services\EncryptionService;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

class ProfileController extends Controller
{
    /**
     * Show the user's profile settings page.
     */
    public function edit(Request $request): Response
    {
        return Inertia::render('settings/profile', [
            'mustVerifyEmail' => $request->user() instanceof MustVerifyEmail,
            'status' => $request->session()->get('status'),
        ]);
    }

    /**
     * Update the user's profile settings.
     */
    public function update(ProfileUpdateRequest $request): RedirectResponse
    {
        $request->user()->fill($request->validated());

        if ($request->user()->isDirty('email')) {
            $request->user()->email_verified_at = null;
        }

        $request->user()->save();

        return to_route('profile.edit');
    }

    protected $encryptionService;

    public function __construct(EncryptionService $encryptionService)
    {
        $this->encryptionService = $encryptionService;
    }

    /**
     * Update signature settings (PIN and Image).
     */
    public function updateSignature(Request $request): RedirectResponse
    {
        $hasExistingKey = $this->encryptionService->hasKeys($request->user());

        $request->validate([
            'pin' => ['nullable', 'string', 'digits:6', 'confirmed'],
            'pin_confirmation' => ['required_with:pin', 'string', 'digits:6'],
            // Required to re-authenticate and decrypt the existing private key
            // when the user already has one, so it can be re-encrypted with the
            // new PIN instead of being replaced (which would invalidate every
            // digital signature created with the old key pair).
            'current_pin' => [$hasExistingKey ? 'required' : 'nullable', 'string', 'digits:6'],
            'signature_image' => ['nullable', 'image', 'max:2048'], // 2MB max
        ]);

        $user = $request->user();

        if ($request->filled('pin')) {
            if ($hasExistingKey) {
                if (! Hash::check($request->current_pin, $user->pin)) {
                    return back()->withErrors(['current_pin' => 'PIN saat ini salah.']);
                }

                try {
                    $this->encryptionService->rekeyPassphrase($user, $request->current_pin, $request->pin);
                } catch (\Exception $e) {
                    \Log::error('Failed to rekey encryption key on PIN update', ['error' => $e->getMessage()]);

                    return back()->withErrors(['pin' => 'Gagal mengganti PIN: '.$e->getMessage()]);
                }
            } else {
                // First-time PIN setup: no existing key pair to preserve.
                try {
                    $this->encryptionService->generateKeyPair($user, $request->pin);
                } catch (\Exception $e) {
                    \Log::error('Failed to generate keys on PIN update', ['error' => $e->getMessage()]);

                    return back()->withErrors(['pin' => 'Gagal membuat kunci enkripsi: '.$e->getMessage()]);
                }
            }

            $user->pin = bcrypt($request->pin);
            $user->save();
        }

        if ($request->hasFile('signature_image')) {
            // Delete old image if exists
            if ($user->signature_image && Storage::exists($user->signature_image)) {
                Storage::delete($user->signature_image);
            }

            $path = $request->file('signature_image')->store('signatures/images', 'public');
            $user->signature_image = $path;
        }

        $user->save();

        return back()->with('success', 'Signature settings updated.');
    }

    /**
     * Delete the user's account.
     */
    public function destroy(Request $request): RedirectResponse
    {
        $request->validate([
            'password' => ['required', 'current_password'],
        ]);

        $user = $request->user();

        Auth::logout();

        $user->delete();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect('/');
    }
}
