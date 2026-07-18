import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('version_metadata')
export class VersionMetadata {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  version: number;

  @Column({ name: 'generated_at', nullable: true })
  generatedAt: string;

  @Column({ name: 'total_lines', default: 0 })
  totalLines: number;

  @Column({ name: 'total_transfers', default: 0 })
  totalTransfers: number;

  @Column({ name: 'data_download_url', nullable: true })
  dataDownloadUrl: string;

  @Column({ name: 'checksum_sha256', nullable: true })
  checksumSha256: string;

  @Column({ name: 'size_bytes', type: 'int', default: 0 })
  sizeBytes: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
