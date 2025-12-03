<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;

class TemplateSigner extends Model
{
    use HasFactory, HasUuids;

    protected $fillable = [
        'template_id',
        'user_id',
        'is_signed',
        'sign_order',
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
