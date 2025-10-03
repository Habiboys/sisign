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
        'position_x',
        'position_y',
        'width',
        'height',
        'page_number',
        'digital_signature',
        'signature_timestamp',
        'certificate_info',
        'signedAt',
    ];

    protected $casts = [
        'signedAt' => 'datetime',
        'isUnique' => 'boolean',
        'signature_timestamp' => 'datetime',
        'position_x' => 'integer',
        'position_y' => 'integer',
        'width' => 'integer',
        'height' => 'integer',
        'page_number' => 'integer',
    ];

    protected $dates = [
        'signedAt',
        'signature_timestamp'
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
        return $this->belongsTo(\App\Models\User::class, 'userId');
    }
}
