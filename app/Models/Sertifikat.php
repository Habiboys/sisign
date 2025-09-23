<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Sertifikat extends Model
{
    use SoftDeletes, HasUuids;

    protected $table = 'sertifikat';

    protected $fillable = [
        'templateSertifId',
        'nomor_sertif',
    ];

    protected $casts = [
        'createdAt' => 'datetime',
        'updatedAt' => 'datetime',
    ];

    public function templateSertif(): BelongsTo
    {
        return $this->belongsTo(TemplateSertif::class, 'templateSertifId');
    }

    public function certificateRecipients(): HasMany
    {
        return $this->hasMany(CertificateRecipient::class, 'sertifikatId');
    }
}
