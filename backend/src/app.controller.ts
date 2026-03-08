import { Controller, Get, Redirect } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('root')
@Controller()
export class AppController {
  @Get()
  @Redirect('/api/docs', 302)
  @ApiOperation({ summary: 'Redirect to API documentation' })
  root() {
    // Redirects to Swagger UI
  }
}
