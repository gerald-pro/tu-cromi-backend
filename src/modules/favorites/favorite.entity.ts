import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Line } from '../lines/line.entity';

@Entity('favorites')
export class Favorite {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'line_id' })
  lineId: string;

  @Column({ nullable: true })
  name: string;

  @ManyToOne(() => User, (user) => user.favorites, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Line, (line) => line.favorites, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'line_id' })
  line: Line;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
