<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class DocumentSigner extends Model
{
    use HasFactory, HasUuids;

    protected $fillable = [
        'document_id',
        'user_id',
        'is_signed',
        'sign_order',
    ];

    protected $casts = [
        'is_signed' => 'boolean',
        'sign_order' => 'integer',
    ];

    public function document()
    {
        return $this->belongsTo(Document::class, 'document_id');
    }

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}
