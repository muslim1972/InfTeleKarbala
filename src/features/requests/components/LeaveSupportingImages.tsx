import React, { useState } from 'react';
import { Upload, X, Image as ImageIcon, Loader2 } from 'lucide-react';
import { supabase } from '../../../lib/supabase';

interface Props {
  onImagesChange: (urls: string[]) => void;
  maxImages?: number;
}

const LeaveSupportingImages: React.FC<Props> = ({ onImagesChange, maxImages = 3 }) => {
  const [images, setImages] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    if (images.length + files.length > maxImages) {
      setError(`يمكنك رفع كحد أقصى ${maxImages} صور.`);
      return;
    }

    setError(null);
    setIsUploading(true);

    try {
      const newUrls: string[] = [];
      for (const file of files) {
        // Validate file type
        if (!file.type.startsWith('image/')) {
            throw new Error('يرجى اختيار ملفات صور فقط');
        }

        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError, data } = await supabase.storage
          .from('order-image')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from('order-image')
          .getPublicUrl(filePath);

        newUrls.push(publicUrlData.publicUrl);
      }

      const updatedImages = [...images, ...newUrls];
      setImages(updatedImages);
      onImagesChange(updatedImages);
    } catch (err: any) {
      console.error('Error uploading image:', err);
      setError(err.message || 'حدث خطأ أثناء رفع الصورة');
    } finally {
      setIsUploading(false);
      if (e.target) e.target.value = ''; // reset
    }
  };

  const removeImage = (indexToRemove: number) => {
    const updatedImages = images.filter((_, i) => i !== indexToRemove);
    setImages(updatedImages);
    onImagesChange(updatedImages);
    setError(null);
  };

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
        المرفقات والصور الداعمة (اختياري)
      </label>
      
      {images.length < maxImages && (
        <div className="flex items-center justify-center w-full">
          <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-xl cursor-pointer bg-gray-50 dark:hover:bg-bray-800 dark:bg-slate-900 hover:bg-gray-100 dark:border-slate-700 dark:hover:border-slate-600 dark:hover:bg-slate-800 transition-colors">
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              {isUploading ? (
                <Loader2 className="w-8 h-8 mb-3 text-gray-400 animate-spin" />
              ) : (
                <Upload className="w-8 h-8 mb-3 text-gray-400" />
              )}
              <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
                <span className="font-semibold">اضغط للرفع</span> أو اسحب وأفلت هنا
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">PNG, JPG (الأقصى {maxImages} صور)</p>
            </div>
            <input 
                type="file" 
                className="hidden" 
                accept="image/*" 
                multiple 
                onChange={handleFileChange} 
                disabled={isUploading}
            />
          </label>
        </div>
      )}

      {error && <p className="text-red-500 text-xs font-semibold">{error}</p>}

      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mt-3">
          {images.map((url, i) => (
            <div key={i} className="relative group rounded-lg overflow-hidden border border-gray-200 dark:border-slate-700 aspect-square bg-gray-100 dark:bg-slate-800">
              <img src={url} alt={`مرفق ${i+1}`} className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => removeImage(i)}
                className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-md hover:bg-red-600"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default LeaveSupportingImages;
