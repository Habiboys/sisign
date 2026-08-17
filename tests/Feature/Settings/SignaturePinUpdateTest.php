<?php

namespace Tests\Feature\Settings;

use App\Models\EncryptionKey;
use App\Models\User;
use App\Services\EncryptionService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class SignaturePinUpdateTest extends TestCase
{
    use RefreshDatabase;

    public function test_setting_pin_for_the_first_time_generates_a_new_key_pair(): void
    {
        $user = User::factory()->create(['pin' => null]);

        $response = $this
            ->actingAs($user)
            ->post(route('profile.signature.update'), [
                'pin' => '123456',
                'pin_confirmation' => '123456',
            ]);

        $response->assertSessionHasNoErrors();

        $user->refresh();
        $this->assertTrue(Hash::check('123456', $user->pin));
        $this->assertTrue(EncryptionKey::where('userId', $user->id)->exists());
    }

    public function test_changing_pin_requires_current_pin_when_a_key_pair_already_exists(): void
    {
        $user = User::factory()->create();
        app(EncryptionService::class)->generateKeyPair($user, '111111');
        $user->pin = bcrypt('111111');
        $user->save();

        $response = $this
            ->actingAs($user)
            ->post(route('profile.signature.update'), [
                'pin' => '654321',
                'pin_confirmation' => '654321',
            ]);

        $response->assertSessionHasErrors('current_pin');
    }

    public function test_changing_pin_with_wrong_current_pin_fails(): void
    {
        $user = User::factory()->create();
        app(EncryptionService::class)->generateKeyPair($user, '111111');
        $user->pin = bcrypt('111111');
        $user->save();

        $response = $this
            ->actingAs($user)
            ->post(route('profile.signature.update'), [
                'current_pin' => '000000',
                'pin' => '654321',
                'pin_confirmation' => '654321',
            ]);

        $response->assertSessionHasErrors('current_pin');
        $this->assertTrue(Hash::check('111111', $user->fresh()->pin));
    }

    public function test_changing_pin_rekeys_private_key_without_changing_public_key(): void
    {
        $user = User::factory()->create();
        $encryptionService = app(EncryptionService::class);
        $encryptionService->generateKeyPair($user, '111111');
        $user->pin = bcrypt('111111');
        $user->save();

        $originalPublicKey = EncryptionKey::where('userId', $user->id)->first()->publicKey;

        $response = $this
            ->actingAs($user)
            ->post(route('profile.signature.update'), [
                'current_pin' => '111111',
                'pin' => '654321',
                'pin_confirmation' => '654321',
            ]);

        $response->assertSessionHasNoErrors();

        $user->refresh();
        $this->assertTrue(Hash::check('654321', $user->pin));

        $encryptionKey = EncryptionKey::where('userId', $user->id)->first();
        $this->assertSame($originalPublicKey, $encryptionKey->publicKey);

        // The private key must now be decryptable with the new PIN...
        $this->assertNotFalse(openssl_pkey_get_private($encryptionKey->privateKey, '654321'));
        // ...and no longer with the old one.
        $this->assertFalse(openssl_pkey_get_private($encryptionKey->privateKey, '111111'));
    }

    public function test_a_signature_created_before_the_pin_change_still_verifies_after_the_pin_change(): void
    {
        $user = User::factory()->create();
        $encryptionService = app(EncryptionService::class);
        $encryptionService->generateKeyPair($user, '111111');
        $user->pin = bcrypt('111111');
        $user->save();

        $data = 'document-hash-fixture';
        $encryptionKey = EncryptionKey::where('userId', $user->id)->first();
        $signature = $encryptionService->signData($data, $encryptionKey->privateKey, '111111');

        $this
            ->actingAs($user)
            ->post(route('profile.signature.update'), [
                'current_pin' => '111111',
                'pin' => '654321',
                'pin_confirmation' => '654321',
            ])
            ->assertSessionHasNoErrors();

        $publicKey = $encryptionService->getPublicKey($user->fresh());
        $this->assertTrue($encryptionService->verifySignature($data, $signature, $publicKey));
    }
}
