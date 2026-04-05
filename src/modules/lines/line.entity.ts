import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { LineSense } from './line-sense.enum';
import { Favorite } from '../favorites/favorite.entity';

@Entity('lines')
export class Line {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  code: string;

  @Column({ nullable: true })
  name: string;

  @Column({ nullable: true })
  color: string;

  @Column({ name: 'geo_json', type: 'jsonb', nullable: true })
  geoJson: object;

  @Column({
    type: 'enum',
    enum: LineSense,
    default: LineSense.OUTBOUND,
  })
  sense: LineSense;

  @Column({ name: 'parent_line_id', nullable: true })
  parentLineId: string;

  @ManyToOne(() => Line, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'parent_line_id' })
  parentLine: Line;

  @OneToMany(() => Line, (line) => line.parentLine)
  oppositeLines: Line[];

  @Column({ nullable: true })
  syndicate: string;

  @Column({ nullable: true })
  objectid: number;

  @OneToMany(() => Favorite, (favorite) => favorite.line)
  favorites: Favorite[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
