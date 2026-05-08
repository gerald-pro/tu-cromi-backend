import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Line } from '../lines/line.entity';

@Entity('reviews')
@Unique(['userId', 'lineId'])
export class Review {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id' })
  userId: number;

  @Column({ name: 'line_id' })
  lineId: number;

  @Column({ type: 'int' })
  rating: number;

  @Column({ nullable: true, length: 500 })
  comment: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Line, (line) => line.reviews, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'line_id' })
  line: Line;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date;
}
