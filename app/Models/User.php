<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Fortify\TwoFactorAuthenticatable;

class User extends Authenticatable
{
    /** @use HasFactory<\Database\Factories\UserFactory> */
    use HasFactory, Notifiable, TwoFactorAuthenticatable, SoftDeletes, HasUuids;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'role',
        'pin',
        'signature_image',
    ];
    protected $keyType = 'string';   // penting!
    public $incrementing = false;    // matikan auto increment


    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
        'pin',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    public function isAdmin(): bool
    {
        return $this->role === 'admin';
    }

    public function isPimpinan(): bool
    {
        return $this->role === 'pimpinan';
    }

    public function isPengaju(): bool
    {
        return $this->role === 'pengaju';
    }

    public function documents(): HasMany
    {
        return $this->hasMany(Document::class, 'userId');
    }

    public function documentsTo(): HasMany
    {
        return $this->hasMany(Document::class, 'to');
    }

    public function reviews(): HasMany
    {
        return $this->hasMany(Review::class, 'disetujui');
    }

    public function signatures(): HasMany
    {
        return $this->hasMany(Signature::class, 'userId');
    }

    public function logs(): HasMany
    {
        return $this->hasMany(Log::class, 'userId');
    }

    public function encryptionKey(): HasMany
    {
        return $this->hasMany(EncryptionKey::class, 'userId');
    }

    public function certificateRecipients(): HasMany
    {
        return $this->hasMany(CertificateRecipient::class, 'userId');
    }
}
