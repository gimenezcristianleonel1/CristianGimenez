import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@modules/auth/decorators/current-user.decorator';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

@ApiTags('Tasks')
@ApiBearerAuth()
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  @ApiOperation({ summary: 'Crear una tarea (amarrada al establecimiento del usuario)' })
  create(@CurrentUser('establishmentId') est: string, @Body() dto: CreateTaskDto) {
    return this.tasksService.create(est, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar tareas (orden por dueDate asc) + notificación de próximas a vencer',
  })
  findAll(@CurrentUser('establishmentId') est: string) {
    return this.tasksService.findAll(est);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar una tarea (COMPLETED registra completedAt automático)' })
  update(
    @CurrentUser('establishmentId') est: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.tasksService.update(est, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Eliminar una tarea del establecimiento' })
  async remove(
    @CurrentUser('establishmentId') est: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    await this.tasksService.remove(est, id);
  }
}
