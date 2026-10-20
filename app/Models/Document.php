<?php

namespace App\Models;

use Database\Factories\DocumentFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Document extends Model
{
    /** @use HasFactory<DocumentFactory> */
    use HasFactory, HasUuids, SoftDeletes;

    protected $table = 'document';

    protected $fillable = [
        'userId',
        'title',
        'files',
        'signed_file',
        'content_hash',
        'number',
        'to',
        'reviewId',
    ];

    protected $keyType = 'string';   // penting!

    public $incrementing = false;    // matikan auto increment

    public function user()
    {
        return $this->belongsTo(User::class, 'userId');
    }

    public function toUser()
    {
        return $this->belongsTo(User::class, 'to');
    }

    public function review()
    {
        return $this->belongsTo(Review::class, 'reviewId');
    }

    public function signatures()
    {
        return $this->hasMany(Signature::class, 'documentId');
    }

    public function signers()
    {
        return $this->hasMany(DocumentSigner::class, 'document_id');
    }

    public function isCompleted(): bool
    {
        // Check if all signers have signed
        $totalSigners = $this->signers()->count();
        if ($totalSigners === 0) {
            // Fallback for legacy documents or if no signers defined yet
            return false;
        }

        $signedCount = $this->signers()->where('is_signed', true)->count();

        return $totalSigners === $signedCount;
    }

    /**
     * Cek apakah user adalah signer sah untuk dokumen ini dan belum menandatangani.
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
     * Ambil record DocumentSigner milik user.
     */
    public function signerFor(User $user): ?DocumentSigner
    {
        return $this->signers()
            ->where('user_id', $user->id)
            ->first();
    }

    /**
     * Pastikan semua signer dengan sign_order lebih kecil sudah menandatangani
     * sebelum signer ini diizinkan menandatangani.
     */
    public function canSignNow(DocumentSigner $signer): bool
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
