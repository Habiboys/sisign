<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Http\Requests\Settings\ProfileUpdateRequest;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
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

    public function __construct(\App\Services\EncryptionService $encryptionService)
    {
        $this->encryptionService = $encryptionService;
    }

    /**
     * Update signature settings (PIN and Image).
     */
    public function updateSignature(Request $request): RedirectResponse
    {
        $request->validate([
            'pin' => ['nullable', 'string', 'digits:6'],
            'signature_image' => ['nullable', 'image', 'max:2048'], // 2MB max
        ]);

        $user = $request->user();

        if ($request->filled('pin')) {
            $user->pin = bcrypt($request->pin);
            $user->save(); // Save user first

            // Always regenerate keys when PIN changes to ensure they match
            // This ensures the private key is encrypted with the new PIN
            try {
                $this->encryptionService->generateKeyPair($user, $request->pin);
            } catch (\Exception $e) {
                \Log::error('Failed to regenerate keys on PIN update', ['error' => $e->getMessage()]);
                // We don't stop the request, but we log the error
            }
        }

        if ($request->hasFile('signature_image')) {
            // Delete old image if exists
            if ($user->signature_image && \Illuminate\Support\Facades\Storage::exists($user->signature_image)) {
                \Illuminate\Support\Facades\Storage::delete($user->signature_image);
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
