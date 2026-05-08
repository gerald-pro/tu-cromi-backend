import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { IssueReportType } from './issue-report-type.enum';
import { IssueReportStatus } from './issue-report-status.enum';
import { User } from '../users/user.entity';
import { Line } from '../lines/line.entity';

@Entity('issue_reports')
export class IssueReport {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id', nullable: true })
  userId: number;

  @Column({ name: 'line_id', nullable: true })
  lineId: number;

  @Column({ type: 'enum', enum: IssueReportType })
  type: IssueReportType;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'jsonb', nullable: true })
  location: object;

  @Column({
    type: 'enum',
    enum: IssueReportStatus,
    default: IssueReportStatus.PENDING,
  })
  status: IssueReportStatus;

  @Column({ name: 'admin_notes', type: 'text', nullable: true })
  adminNotes: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Line, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'line_id' })
  line: Line;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date;
}
