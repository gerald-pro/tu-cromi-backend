import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('line_transfers')
@Index(['lineAId', 'lineBId'])
@Index(['lineBId', 'lineAId'])
export class LineTransfer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'line_a_id' })
  lineAId: string;

  @Column({ name: 'line_b_id' })
  lineBId: string;

  @Column({ type: 'float', name: 'point_a_lng' })
  pointALng: number;

  @Column({ type: 'float', name: 'point_a_lat' })
  pointALat: number;

  @Column({ type: 'int', name: 'point_a_index' })
  pointAIndex: number;

  @Column({ type: 'float', name: 'point_b_lng' })
  pointBLng: number;

  @Column({ type: 'float', name: 'point_b_lat' })
  pointBLat: number;

  @Column({ type: 'int', name: 'point_b_index' })
  pointBIndex: number;

  @Column({ type: 'float', name: 'walk_distance' })
  walkDistance: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
