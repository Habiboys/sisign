<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Signature extends Model
{
    use HasUuids;

    protected $fillable = [
        'documentId',
        'templateSertifId',
        'userId',
        'type',
        'signatureFile',
        'signatureHash',
        'signatureData',
        'isUnique',
    ];

    protected $casts = [
        'signedAt' => 'datetime',
        'isUnique' => 'boolean',
    ];

    public function document(): BelongsTo
    {
        return $this->belongsTo(Document::class, 'documentId');
    }

    public function templateSertif(): BelongsTo
    {
        return $this->belongsTo(TemplateSertif::class, 'templateSertifId');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'userId');
    }
}
