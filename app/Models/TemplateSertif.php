<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class TemplateSertif extends Model
{
    use HasFactory, HasUuids, SoftDeletes;

    protected $table = 'template_sertif';

    protected $fillable = [
        'files',
        'title',
        'description',
        'reviewId',
        'signed_template_path',
        'content_hash',
        'variable_positions',
    ];

    protected $casts = [
        'created_at' => 'datetime',
        'updatedAt' => 'datetime',
        'variable_positions' => 'array',
    ];

    // Override timestamp column names
    const CREATED_AT = 'created_at';

    const UPDATED_AT = 'updatedAt';

    public function review(): BelongsTo
    {
        return $this->belongsTo(Review::class, 'reviewId');
    }

    public function sertifikats(): HasMany
    {
        return $this->hasMany(Sertifikat::class, 'templateSertifId');
    }

    public function signers(): HasMany
    {
        return $this->hasMany(TemplateSigner::class, 'template_id');
    }

    public function signatures(): HasMany
    {
        return $this->hasMany(Signature::class, 'templateSertifId');
    }

    public function isCompleted(): bool
    {
        // Check if all signers have signed
        $totalSigners = $this->signers()->count();
        if ($totalSigners === 0) {
            // Fallback for legacy templates or if no signers defined yet
            return false;
        }

        $signedCount = $this->signers()->where('is_signed', true)->count();

        return $totalSigners === $signedCount;
    }

    /**
     * Cek apakah user adalah signer sah untuk template ini dan belum menandatangani.
     */
    public function canUserSign(User $user): bool
    {
        return $user->isPimpinan()
            && $this->signers()
                ->where('user_id', $user->id)
                ->where('is_signed', false)
                ->exists();
    }

    /**
     * Ambil record TemplateSigner milik user.
     */
    public function signerFor(User $user): ?TemplateSigner
    {
        return $this->signers()
            ->where('user_id', $user->id)
            ->first();
    }

    /**
     * Pastikan semua signer dengan sign_order lebih kecil sudah menandatangani
     * sebelum signer ini diizinkan menandatangani.
     */
    public function canSignNow(TemplateSigner $signer): bool
    {
        // Legacy data kadang tidak memiliki sign_order — jangan paksa enforce.
        if ($signer->sign_order === null) {
            return true;
        }

        return ! $this->signers()
            ->where('sign_order', '<', $signer->sign_order)
            ->where('is_signed', false)
            ->exists();
    }
}
