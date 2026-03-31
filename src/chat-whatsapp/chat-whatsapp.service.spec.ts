import { Test, TestingModule } from '@nestjs/testing';
import { ChatWhatsappService } from './chat-whatsapp.service';

describe('ChatWhatsappService', () => {
  let service: ChatWhatsappService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ChatWhatsappService],
    }).compile();

    service = module.get<ChatWhatsappService>(ChatWhatsappService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
