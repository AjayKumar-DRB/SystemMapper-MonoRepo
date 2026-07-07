import { Controller, Get, Post, Param, Body, Query, HttpException, HttpStatus } from '@nestjs/common';
import { VisualizationService } from './visualization.service';

@Controller('visualization')
export class VisualizationController {
  constructor(private readonly visualizationService: VisualizationService) {}

  @Get('repository/:id')
  async getRepositoryGraph(
    @Param('id') id: string, 
    @Query('branch') branch?: string,
    @Query('view') view?: 'project' | 'component',
    @Query('folderId') folderId?: string
  ) {
    try {
      return await this.visualizationService.getRepositoryGraph(id, branch, view || 'project', folderId);
    } catch (error: any) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('repository/:id/branches')
  async getBranches(@Param('id') id: string) {
    try {
      return await this.visualizationService.getBranches(id);
    } catch (error: any) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('explore')
  async explorePublicRepository(@Body() body: { url: string; branch?: string }) {
    if (!body.url) {
      throw new HttpException('Repository URL is required', HttpStatus.BAD_REQUEST);
    }
    try {
      const jobId = await this.visualizationService.dispatchExploreJob(body.url, body.branch);
      return { jobId };
    } catch (error: any) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('explore/:jobId/status')
  async getExploreJobStatus(@Param('jobId') jobId: string) {
    try {
      const status = await this.visualizationService.getExploreJobStatus(jobId);
      return status;
    } catch (error: any) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
