<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class TemplateSigner extends Model
{
    use HasFactory, HasUuids;

    protected $fillable = [
        'template_id',
        'user_id',
        'is_signed',
        'sign_order',
    ];

    protected $casts = [
        'is_signed' => 'boolean',
        'sign_order' => 'integer',
    ];

    public function template()
    {
        return $this->belongsTo(TemplateSertif::class, 'template_id');
    }

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}
