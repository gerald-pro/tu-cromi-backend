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
import { Review } from '../reviews/review.entity';

@Entity('lines')
export class Line {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  code: string;

  @Column({ nullable: true })
  name: string;

  @Column({ nullable: true })
  color: string;

  @Column({ name: 'geo_json', type: 'jsonb', nullable: true })
  geoJson: object;

  @Column({
    name: 'geom',
    type: 'geometry',
    spatialFeatureType: 'MultiLineString',
    srid: 4326,
    nullable: true,
  })
  geom: object;

  @Column({
    type: 'enum',
    enum: LineSense,
    default: LineSense.OUTBOUND,
  })
  sense: LineSense;

  @Column({ name: 'parent_line_id', nullable: true })
  parentLineId: number;

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

  @Column({
    name: 'average_rating',
    type: 'decimal',
    precision: 3,
    scale: 2,
    nullable: true,
    default: null,
  })
  averageRating: number | null;

  @Column({ name: 'total_reviews', default: 0 })
  totalReviews: number;

  @OneToMany(() => Review, (review) => review.line)
  reviews: Review[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
