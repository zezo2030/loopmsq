import { Injectable } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';

@Injectable()
export class CloudinaryService {
  constructor(private configService: ConfigService) {
    cloudinary.config({
      cloud_name: this.configService.get<string>('CLOUDINARY_CLOUD_NAME'),
      api_key: this.configService.get<string>('CLOUDINARY_API_KEY'),
      api_secret: this.configService.get<string>('CLOUDINARY_API_SECRET'),
    });
  }

  async uploadVideo(file: Express.Multer.File, folder: string = 'videos'): Promise<{ videoUrl: string; coverUrl: string }> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          resource_type: 'video',
          folder: folder,
          eager: [
            { format: 'mp4', quality: 'auto' },
          ],
          eager_async: true,
        },
        async (error, result) => {
          if (error) {
            reject(error);
          } else if (!result || !result.secure_url) {
            reject(new Error('Upload failed: No result from Cloudinary'));
          } else {
            try {
              // Generate thumbnail from video using Cloudinary transformations
              // Cloudinary can extract a frame from video and convert it to image
              const publicId = result.public_id;
              
              // Method 1: Use cloudinary.url with format: 'jpg' to generate thumbnail
              // This automatically extracts a frame from the video and converts it to JPG
              const coverUrl = cloudinary.url(publicId, {
                resource_type: 'video',
                format: 'jpg',
                transformation: [
                  { 
                    width: 800, 
                    height: 450, 
                    crop: 'fill',
                    quality: 'auto',
                  },
                ],
                secure: true,
              });
              
              resolve({
                videoUrl: result.secure_url,
                coverUrl: coverUrl,
              });
            } catch (thumbnailError) {
              console.error('Error generating thumbnail:', thumbnailError);
              // If thumbnail generation fails, return video URL only
              resolve({
                videoUrl: result.secure_url,
                coverUrl: result.secure_url, // Fallback to video URL
              });
            }
          }
        }
      );
      
      // Use buffer if available (memory storage), otherwise read from disk
      if (file.buffer) {
        uploadStream.end(file.buffer);
      } else if (file.path) {
        fs.createReadStream(file.path).pipe(uploadStream);
      } else {
        reject(new Error('File buffer or path is required'));
      }
    });
  }

  async uploadImage(file: Express.Multer.File, folder: string = 'images'): Promise<string> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          resource_type: 'image',
          folder: folder,
          transformation: [
            { quality: 'auto', fetch_format: 'auto' }
          ],
        },
        (error, result) => {
          if (error) {
            reject(error);
          } else if (!result || !result.secure_url) {
            reject(new Error('Upload failed: No result from Cloudinary'));
          } else {
            resolve(result.secure_url);
          }
        }
      );
      
      // Use buffer if available (memory storage), otherwise read from disk
      if (file.buffer) {
        uploadStream.end(file.buffer);
      } else if (file.path) {
        fs.createReadStream(file.path).pipe(uploadStream);
      } else {
        reject(new Error('File buffer or path is required'));
      }
    });
  }

  async deleteFile(publicId: string, resourceType: 'image' | 'video' = 'video'): Promise<void> {
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
  }
}

