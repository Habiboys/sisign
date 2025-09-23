<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CertificateRecipient extends Model
{
    use HasUuids;

    protected $fillable = [
        'sertifikatId',
        'userId',
    ];

    protected $casts = [
        'issuedAt' => 'datetime',
    ];

    public function sertifikat(): BelongsTo
    {
        return $this->belongsTo(Sertifikat::class, 'sertifikatId');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'userId');
    }
}
